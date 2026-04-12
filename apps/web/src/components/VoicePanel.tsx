import React, { useEffect, useRef } from "react";
import type { LiveSessionStatus, TranscriptEntry } from "../types/index.js";

const VOICES = [
  { name: "Charon", gender: "male" },
  { name: "Puck", gender: "male" },
  { name: "Fenrir", gender: "male" },
  { name: "Orus", gender: "male" },
  { name: "Aoede", gender: "female" },
  { name: "Kore", gender: "female" },
  { name: "Leda", gender: "female" },
  { name: "Zephyr", gender: "female" },
] as const;

interface VoicePanelProps {
  status: LiveSessionStatus;
  transcript: TranscriptEntry[];
  volumeLevel: number;
  isListening: boolean;
  currentVoice: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleMic: () => void;
  onSendText: (text: string) => void;
  onSetVoice: (voice: string) => void;
}

const STATUS_LABELS: Record<LiveSessionStatus, string> = {
  idle: "Disconnected",
  connecting: "Connecting...",
  ready: "Ready",
  listening: "Listening...",
  speaking: "Aegis is speaking...",
  error: "Connection error",
};

const STATUS_COLORS: Record<LiveSessionStatus, string> = {
  idle: "text-gray-500",
  connecting: "text-aegis-amber",
  ready: "text-aegis-green",
  listening: "text-aegis-cyan",
  speaking: "text-aegis-blue",
  error: "text-aegis-red",
};

function WaveformBars({ active, volumeLevel }: { active: boolean; volumeLevel: number }) {
  const barCount = 12;
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {Array.from({ length: barCount }).map((_, i) => {
        const delay = (i % 4) * 0.15;
        const height = active
          ? Math.max(8, volumeLevel * 48 * (0.5 + Math.sin(i * 0.8) * 0.5))
          : 4;
        return (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
              active ? "bg-aegis-cyan" : "bg-navy-700"
            }`}
            style={{
              height: `${height}px`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

export function VoicePanel({
  status,
  transcript,
  volumeLevel,
  isListening,
  currentVoice,
  onConnect,
  onDisconnect,
  onToggleMic,
  onSendText,
  onSetVoice,
}: VoicePanelProps) {
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isConnected = status !== "idle" && status !== "error";

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = inputRef.current?.value.trim();
    if (val) {
      onSendText(val);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header status bar */}
      <div className="card flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              status === "idle" || status === "error"
                ? "bg-gray-600"
                : status === "connecting"
                ? "bg-aegis-amber animate-pulse"
                : "bg-aegis-green"
            }`}
          />
          <span className={`text-sm font-medium ${STATUS_COLORS[status]}`}>
            {STATUS_LABELS[status]}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Voice picker — works both before and during a session */}
          <div className="relative">
            <select
              value={currentVoice}
              onChange={(e) => {
                const v = e.target.value;
                if (isConnected) {
                  onSetVoice(v);
                } else {
                  // Will be passed as URL param on next connect
                  onSetVoice(v);
                }
              }}
              className="appearance-none bg-navy-900 border border-navy-600 text-xs text-gray-300 rounded-lg pl-7 pr-6 py-1.5 focus:outline-none focus:border-aegis-blue/50 cursor-pointer"
            >
              <optgroup label="♂ Male">
                {VOICES.filter((v) => v.gender === "male").map((v) => (
                  <option key={v.name} value={v.name}>{v.name}</option>
                ))}
              </optgroup>
              <optgroup label="♀ Female">
                {VOICES.filter((v) => v.gender === "female").map((v) => (
                  <option key={v.name} value={v.name}>{v.name}</option>
                ))}
              </optgroup>
            </select>
            {/* Gender icon overlay */}
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs">
              {VOICES.find((v) => v.name === currentVoice)?.gender === "female" ? "♀" : "♂"}
            </span>
          </div>

          <button
            onClick={isConnected ? onDisconnect : onConnect}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              isConnected
                ? "bg-red-900/40 text-red-400 hover:bg-red-900/60 border border-red-800"
                : "bg-aegis-blue/20 text-aegis-blue hover:bg-aegis-blue/30 border border-aegis-blue/30"
            }`}
          >
            {isConnected ? "End Session" : "Start Session"}
          </button>
        </div>
      </div>

      {/* Waveform + mic button */}
      <div className="card flex flex-col items-center gap-4 py-6">
        <WaveformBars active={isListening} volumeLevel={volumeLevel} />

        <button
          onClick={onToggleMic}
          disabled={!isConnected || status === "connecting"}
          className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
            isListening
              ? "bg-aegis-red shadow-lg shadow-red-500/30 scale-110"
              : isConnected
              ? "bg-aegis-blue hover:bg-blue-500 shadow-lg shadow-blue-500/20"
              : "bg-navy-700 cursor-not-allowed"
          }`}
        >
          {isListening ? (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          )}
          {isListening && (
            <span className="absolute inset-0 rounded-full bg-aegis-red/40 animate-ping" />
          )}
        </button>

        <p className="text-xs text-gray-500">
          {isListening ? "Tap to stop" : isConnected ? "Tap to speak" : "Start a session first"}
        </p>
      </div>

      {/* Transcript */}
      <div className="card flex-1 flex flex-col min-h-0">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Conversation
        </h3>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {transcript.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">
              Start a session and speak to Aegis
            </p>
          ) : (
            transcript.map((entry) => (
              <div
                key={entry.id}
                className={`flex gap-2 ${entry.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {entry.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-aegis-blue/20 border border-aegis-blue/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-aegis-blue text-[10px] font-bold">A</span>
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    entry.role === "user"
                      ? "bg-aegis-blue/20 text-blue-100 border border-aegis-blue/20"
                      : entry.text.startsWith("[Searching")
                      ? "bg-amber-900/20 text-amber-400 border border-amber-800/30 text-xs italic"
                      : "bg-navy-700 text-gray-200 border border-navy-600"
                  }`}
                >
                  {entry.text}
                </div>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* Text input fallback */}
        {isConnected && (
          <form onSubmit={handleTextSubmit} className="mt-3 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a message..."
              className="flex-1 bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-aegis-blue/50"
            />
            <button type="submit" className="btn-primary text-sm py-2">
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
