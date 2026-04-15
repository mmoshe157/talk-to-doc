import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveSessionStatus, TranscriptEntry } from "../types/index.js";

const _RAW_WS = import.meta.env.VITE_WS_URL ?? "";
const WS_URL = _RAW_WS || "/ws/live";
const SAMPLE_RATE = 16000;
const GEMINI_OUTPUT_RATE = 24000;
const PCM_BUFFER_SIZE = 4096;
const LOOKAHEAD = 0.05; // 50 ms lookahead for smooth playback

function base64ToPcm16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer as ArrayBuffer);
}

export interface LiveDiagram {
  title: string;
  chart: string;
  description: string;
}

export function useGeminiLive(sessionId: string, apiKey = "", mode = "docs", silentMode = false) {
  const [status, setStatus] = useState<LiveSessionStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [currentVoice, setCurrentVoice] = useState("Charon");
  const [currentDiagram, setCurrentDiagram] = useState<LiveDiagram | null>(null);

  // Refs that always hold the latest values — used inside WS callbacks to avoid stale closures
  const statusRef = useRef<LiveSessionStatus>("idle");
  const isListeningRef = useRef(false);
  const currentVoiceRef = useRef("Charon");

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Playback context — created during user interaction (connect click) to avoid suspension
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  // Keep a ref to the latest startMicrophone so session_ready can auto-start it
  const startMicrophoneRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const setStatusBoth = (s: LiveSessionStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  const updateVoice = (v: string) => {
    currentVoiceRef.current = v;
    setCurrentVoice(v);
  };

  const addTranscriptEntry = useCallback((role: "user" | "assistant", text: string) => {
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: new Date() },
      ];
    });
  }, []);

  // ── Audio playback ────────────────────────────────────────────────────────

  const getPlaybackCtx = useCallback(() => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === "closed") {
      playbackCtxRef.current = new AudioContext({ sampleRate: GEMINI_OUTPUT_RATE });
      nextPlayTimeRef.current = 0;
    }
    return playbackCtxRef.current;
  }, []);

  const playAudioChunk = useCallback((base64Audio: string) => {
    const ctx = getPlaybackCtx();

    const schedule = () => {
      const pcm16 = base64ToPcm16(base64Audio);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

      const buffer = ctx.createBuffer(1, float32.length, GEMINI_OUTPUT_RATE);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now + LOOKAHEAD, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;
    };

    if (ctx.state === "suspended") {
      // Await resume before scheduling so audio isn't silently dropped
      ctx.resume().then(schedule).catch(() => undefined);
    } else {
      schedule();
    }
  }, [getPlaybackCtx]);

  const stopAudioPlayback = useCallback(() => {
    if (playbackCtxRef.current && playbackCtxRef.current.state !== "closed") {
      playbackCtxRef.current.close().catch(() => undefined);
    }
    playbackCtxRef.current = null;
    nextPlayTimeRef.current = 0;
  }, []);

  // ── Microphone ────────────────────────────────────────────────────────────

  const stopMicrophone = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    isListeningRef.current = false;
    setIsListening(false);
    setVolumeLevel(0);
  }, []);

  const startMicrophone = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (isListeningRef.current) return; // already listening

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(PCM_BUFFER_SIZE, 1, 1);
      processorRef.current = processor;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      source.connect(processor);
      processor.connect(ctx.destination);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      processor.onaudioprocess = (e) => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setVolumeLevel(avg / 128);

        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          pcm16[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
        }
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(pcm16.buffer);
        }
      };

      isListeningRef.current = true;
      setIsListening(true);
      setStatusBoth("listening");
    } catch (err) {
      console.error("Microphone access error:", err);
      setStatusBoth("error");
    }
  }, []);

  // Keep the ref current so ws.onmessage can call the latest startMicrophone
  useEffect(() => {
    startMicrophoneRef.current = startMicrophone;
  }, [startMicrophone]);

  // ── WebSocket connection ──────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatusBoth("connecting");
    setTranscript([]);

    // Pre-create the playback AudioContext now (during user gesture click)
    // so it starts in "running" state — avoids browser autoplay suspension.
    if (!playbackCtxRef.current || playbackCtxRef.current.state === "closed") {
      playbackCtxRef.current = new AudioContext({ sampleRate: GEMINI_OUTPUT_RATE });
      nextPlayTimeRef.current = 0;
    }

    const voice = currentVoiceRef.current;
    const keyParam = apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : "";
    const silentParam = silentMode ? "&silent=true" : "";
    const url = `${WS_URL}?sessionId=${sessionId}&voice=${encodeURIComponent(voice)}&mode=${mode}${keyParam}${silentParam}`;
    const wsUrl = url.startsWith("/")
      ? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${url}`
      : url;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; payload?: unknown };

        switch (msg.type) {
          case "session_ready": {
            setStatusBoth("ready");
            const sr = msg.payload as { voice?: string } | undefined;
            if (sr?.voice) updateVoice(sr.voice);
            // Auto-start microphone — user already granted permission via the Start button click
            setTimeout(() => startMicrophoneRef.current(), 300);
            break;
          }

          case "voice_changed": {
            const vc = msg.payload as { voice: string };
            updateVoice(vc.voice);
            setStatusBoth("connecting");
            stopAudioPlayback();
            break;
          }

          case "audio":
            if (silentMode) {
              // In silent/meeting mode: suppress audio, show processing state
              if (statusRef.current !== "processing") setStatusBoth("processing");
            } else {
              if (statusRef.current !== "speaking") setStatusBoth("speaking");
              playAudioChunk(msg.payload as string);
            }
            break;

          case "transcript": {
            const t = msg.payload as { role: string; text: string };
            addTranscriptEntry(t.role as "user" | "assistant", t.text);
            break;
          }

          case "interrupted":
            if (!silentMode) stopAudioPlayback();
            setStatusBoth(isListeningRef.current ? "listening" : "ready");
            break;

          case "tool_call": {
            const tc = msg.payload as { name: string; query: string };
            addTranscriptEntry("assistant", `[Searching documents: "${tc.query}"]`);
            break;
          }

          case "diagram": {
            const d = msg.payload as LiveDiagram;
            setCurrentDiagram(d);
            break;
          }

          case "error": {
            const e = msg.payload as { message: string };
            console.error("[Session] error:", e.message);
            setStatusBoth("error");
            break;
          }
        }
      } catch (err) {
        console.error("[WS] Failed to parse message:", err);
      }
    };

    ws.onclose = () => {
      console.log("[WS] closed");
      setStatusBoth("idle");
      stopMicrophone();
    };

    ws.onerror = (err) => {
      console.error("[WS] error:", err);
      setStatusBoth("error");
    };
  }, [sessionId, apiKey, mode, silentMode, playAudioChunk, addTranscriptEntry, stopAudioPlayback, stopMicrophone]);

  const disconnect = useCallback(() => {
    stopMicrophone();
    stopAudioPlayback();
    wsRef.current?.close();
    wsRef.current = null;
    setStatusBoth("idle");
    setCurrentDiagram(null);
  }, [stopMicrophone, stopAudioPlayback]);

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "text", payload: text }));
      addTranscriptEntry("user", text);
    }
  }, [addTranscriptEntry]);

  const setVoice = useCallback((voice: string) => {
    updateVoice(voice);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "set_voice", payload: voice }));
    }
  }, []);

  const toggleMicrophone = useCallback(async () => {
    if (isListeningRef.current) {
      stopMicrophone();
      setStatusBoth("ready");
    } else {
      await startMicrophone();
    }
  }, [stopMicrophone, startMicrophone]);

  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  const clearDiagram = useCallback(() => setCurrentDiagram(null), []);

  return {
    status,
    transcript,
    volumeLevel,
    isListening,
    currentVoice,
    currentDiagram,
    connect,
    disconnect,
    sendText,
    setVoice,
    toggleMicrophone,
    clearDiagram,
  };
}
