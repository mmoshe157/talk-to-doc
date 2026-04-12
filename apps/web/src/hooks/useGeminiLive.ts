import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveSessionStatus, TranscriptEntry } from "../types/index.js";

const WS_URL = import.meta.env.VITE_WS_URL ?? "/ws/live";
const SAMPLE_RATE = 16000;          // mic capture rate
const GEMINI_OUTPUT_RATE = 24000;   // Gemini Live output PCM rate
const PCM_BUFFER_SIZE = 4096;

function base64ToPcm16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer as ArrayBuffer);
}

export function useGeminiLive(vesselId: string) {
  const [status, setStatus] = useState<LiveSessionStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [currentVoice, setCurrentVoice] = useState("Charon");
  // Mirror state → ref so connect() always reads the latest voice
  const updateVoice = (v: string) => {
    currentVoiceRef.current = v;
    setCurrentVoice(v);
  };

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  // Keep voice in a ref so connect() always reads the latest value
  // without being a stale closure, regardless of how it's called.
  const currentVoiceRef = useRef("Charon");

  // Playback: single shared AudioContext at 24kHz, with a tiny lookahead
  // buffer to prevent gaps between chunks (keeps voice smooth).
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const LOOKAHEAD = 0.05; // 50 ms scheduling lookahead

  // Each transcription comes in as incremental fragments from the API.
  // We append to the last entry of the same role rather than creating a new
  // bubble for every word, so the conversation reads naturally.
  const addTranscriptEntry = useCallback((role: "user" | "assistant", text: string) => {
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        // Append to the running entry
        return [
          ...prev.slice(0, -1),
          { ...last, text: last.text + text },
        ];
      }
      return [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: new Date() },
      ];
    });
  }, []);

  const getPlaybackCtx = useCallback(() => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === "closed") {
      playbackCtxRef.current = new AudioContext({ sampleRate: GEMINI_OUTPUT_RATE });
      nextPlayTimeRef.current = 0;
    }
    return playbackCtxRef.current;
  }, []);

  const playAudioChunk = useCallback((base64Audio: string) => {
    const ctx = getPlaybackCtx();

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => undefined);
    }

    const pcm16 = base64ToPcm16(base64Audio);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

    const buffer = ctx.createBuffer(1, float32.length, GEMINI_OUTPUT_RATE);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    // Schedule contiguous with previous chunk (no gaps = smooth voice)
    const now = ctx.currentTime;
    const startTime = Math.max(now + LOOKAHEAD, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
  }, [getPlaybackCtx]);

  const stopAudioPlayback = useCallback(() => {
    if (playbackCtxRef.current && playbackCtxRef.current.state !== "closed") {
      playbackCtxRef.current.close().catch(() => undefined);
    }
    playbackCtxRef.current = null;
    nextPlayTimeRef.current = 0;
  }, []);

  const stopMicrophone = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsListening(false);
    setVolumeLevel(0);
  }, []);

  const startMicrophone = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(PCM_BUFFER_SIZE, 1, 1);
      processorRef.current = processor;

      // Analyser for volume metering
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      source.connect(processor);
      processor.connect(ctx.destination);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      processor.onaudioprocess = (e) => {
        // Volume level
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setVolumeLevel(avg / 128);

        // Convert float32 → int16 PCM and send as binary
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          pcm16[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
        }
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(pcm16.buffer);
        }
      };

      setIsListening(true);
      setStatus("listening");
    } catch (err) {
      console.error("Microphone access error:", err);
      setStatus("error");
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    setTranscript([]);

    // Always read from ref — immune to stale closure and MouseEvent args
    const voice = currentVoiceRef.current;
    const url = `${WS_URL}?vesselId=${vesselId}&voice=${encodeURIComponent(voice)}`;
    const ws = new WebSocket(url.startsWith("/") ? `ws://${location.host}${url}` : url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          payload?: unknown;
        };

        switch (msg.type) {
          case "session_ready": {
            setStatus("ready");
            const sr = msg.payload as { voice?: string } | undefined;
            if (sr?.voice) updateVoice(sr.voice);
            break;
          }

          case "voice_changed": {
            const vc = msg.payload as { voice: string };
            updateVoice(vc.voice);
            // Session is restarting server-side — show connecting briefly
            setStatus("connecting");
            stopAudioPlayback();
            break;
          }

          case "audio":
            if (status !== "speaking") setStatus("speaking");
            playAudioChunk(msg.payload as string);
            break;

          case "transcript": {
            const t = msg.payload as { role: string; text: string };
            addTranscriptEntry(t.role as "user" | "assistant", t.text);
            break;
          }

          case "interrupted":
            stopAudioPlayback();
            setStatus(isListening ? "listening" : "ready");
            break;

          case "tool_call": {
            const tc = msg.payload as { name: string; query: string };
            addTranscriptEntry("assistant", `[Searching manuals: "${tc.query}"]`);
            break;
          }

          case "error": {
            const e = msg.payload as { message: string };
            console.error("Live session error:", e.message);
            setStatus("error");
            break;
          }
        }
      } catch (err) {
        console.error("Failed to parse server message:", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
      setStatus("idle");
      stopMicrophone();
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setStatus("error");
    };
  }, [vesselId, playAudioChunk, addTranscriptEntry, stopAudioPlayback, stopMicrophone, isListening]);

  const disconnect = useCallback(() => {
    stopMicrophone();
    stopAudioPlayback();
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("idle");
  }, [stopMicrophone, stopAudioPlayback]);

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "text", payload: text }));
      addTranscriptEntry("user", text);
    }
  }, [addTranscriptEntry]);

  // Called from the UI voice picker — updates the ref and sends to server
  const setVoice = useCallback((voice: string) => {
    updateVoice(voice);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "set_voice", payload: voice }));
    }
  }, []);

  const toggleMicrophone = useCallback(async () => {
    if (isListening) {
      stopMicrophone();
      setStatus("ready");
    } else {
      await startMicrophone();
    }
  }, [isListening, stopMicrophone, startMicrophone]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    transcript,
    volumeLevel,
    isListening,
    currentVoice,
    connect,
    disconnect,
    sendText,
    setVoice,
    toggleMicrophone,
  };
}
