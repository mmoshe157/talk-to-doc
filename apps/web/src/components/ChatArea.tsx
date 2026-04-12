import React, { useEffect, useRef, useState } from "react";
import type { LiveSessionStatus, TranscriptEntry } from "../types/index.js";

interface ChatAreaProps {
  status: LiveSessionStatus;
  transcript: TranscriptEntry[];
  volumeLevel: number;
  isListening: boolean;
  isHistoryMode?: boolean;
  onToggleMic: () => void;
  onSendText: (text: string) => void;
  onConnect: () => void;
  onExitHistory?: () => void;
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="thinking-dot" />
      <div className="thinking-dot" />
      <div className="thinking-dot" />
    </div>
  );
}

function AIAvatar() {
  return (
    <div className="w-8 h-8 rounded-full gemini-gradient flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 19.5h20L12 2zm0 3.5l7.5 13H4.5L12 5.5z" />
      </svg>
    </div>
  );
}

function WaveformIndicator({ active, volumeLevel }: { active: boolean; volumeLevel: number }) {
  if (!active) return null;
  return (
    <div className="flex items-center gap-0.5 h-5 mx-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const h = Math.max(4, volumeLevel * 20 * (0.4 + Math.sin(i * 1.2) * 0.6));
        return (
          <div
            key={i}
            className="w-1 rounded-full bg-google-blue transition-all duration-75"
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}

export function ChatArea({
  status,
  transcript,
  volumeLevel,
  isListening,
  isHistoryMode = false,
  onToggleMic,
  onSendText,
  onConnect,
  onExitHistory,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");

  const isConnected = status !== "idle" && status !== "error";
  const isThinking = status === "speaking";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, isThinking]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = inputValue.trim();
    if (val && isConnected) {
      onSendText(val);
      setInputValue("");
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── History banner ──────────────────────────── */}
      {isHistoryMode && (
        <div className="flex items-center justify-between px-4 py-2 bg-google-blue-light border-b border-google-blue/20 text-xs text-google-blue">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            You're viewing a past session (read-only)
          </div>
          <button onClick={onExitHistory} className="font-medium hover:underline">
            Start new session →
          </button>
        </div>
      )}

      {/* ── Messages ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {transcript.length === 0 ? (
          <WelcomeScreen status={status} onConnect={onConnect} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {transcript.map((entry) => (
              <MessageBubble key={entry.id} entry={entry} />
            ))}
            {isThinking && (
              <div className="flex items-start gap-3 animate-fade-in">
                <AIAvatar />
                <div className="card px-2 py-1 shadow-google-sm">
                  <ThinkingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input bar (hidden in history mode) ──────── */}
      {isHistoryMode ? null : <div className="border-t border-google-gray-border px-4 py-3 bg-white">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-center gap-3 bg-google-gray-light border border-google-gray-border rounded-full px-4 py-2 focus-within:border-google-blue focus-within:ring-1 focus-within:ring-google-blue/30 transition-all"
        >
          {/* Mic button */}
          <button
            type="button"
            onClick={isConnected ? onToggleMic : onConnect}
            className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isListening
                ? "bg-google-red text-white shadow-md"
                : isConnected
                ? "hover:bg-google-gray-border text-google-gray"
                : "hover:bg-google-blue-light text-google-blue"
            }`}
            title={isListening ? "Stop listening" : isConnected ? "Start listening" : "Start session"}
          >
            {isListening ? (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                <span className="absolute w-9 h-9 rounded-full bg-google-red/30 animate-ping" />
              </>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            )}
          </button>

          <WaveformIndicator active={isListening} volumeLevel={volumeLevel} />

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={!isConnected}
            placeholder={
              isConnected
                ? isListening ? "Listening…" : "Ask about your documents…"
                : "Start a session to chat"
            }
            className="flex-1 bg-transparent text-sm text-[#202124] placeholder-google-gray outline-none disabled:cursor-not-allowed"
          />

          {/* Send button */}
          {inputValue.trim() && isConnected && (
            <button
              type="submit"
              className="flex-shrink-0 w-9 h-9 rounded-full bg-google-blue flex items-center justify-center text-white hover:bg-google-blue-dark transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          )}
        </form>

        {/* Status hint */}
        <p className="text-center text-xs text-google-gray mt-2">
          {status === "idle" && "Click the mic or Start session to begin"}
          {status === "connecting" && "Connecting to AI…"}
          {status === "ready" && "Session active — speak or type"}
          {status === "listening" && "Listening…"}
          {status === "speaking" && "AI is responding…"}
          {status === "error" && "Connection error — try again"}
        </p>
      </div>}
    </div>
  );
}

function MessageBubble({ entry }: { entry: TranscriptEntry }) {
  const isUser = entry.role === "user";
  const isSearch = entry.text.startsWith("[Searching");

  if (isSearch) {
    return (
      <div className="flex items-center gap-2 text-xs text-google-gray animate-fade-in">
        <svg className="w-3.5 h-3.5 animate-spin text-google-blue" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {entry.text}
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 animate-slide-up ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && <AIAvatar />}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-google-blue-light text-[#202124] rounded-tr-sm"
            : "bg-google-gray-light text-[#202124] rounded-tl-sm"
        }`}
      >
        {entry.text}
      </div>
    </div>
  );
}

function WelcomeScreen({
  status,
  onConnect,
}: {
  status: LiveSessionStatus;
  onConnect: () => void;
}) {
  const suggestions = [
    "Summarize the key points of my document",
    "What are the main topics covered?",
    "Find specific information for me",
    "Compare sections across documents",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-8 animate-fade-in">
      {/* Gemini-style hero */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full gemini-gradient shadow-google flex items-center justify-center">
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 19.5h20L12 2zm0 3.5l7.5 13H4.5L12 5.5z" />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-medium text-[#202124]">Talk to Every Doc</h1>
          <p className="text-google-gray mt-1 text-base">
            Upload documents and chat with your files using AI
          </p>
        </div>
      </div>

      {/* Suggestion chips */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={status !== "idle" ? undefined : onConnect}
            className="card px-4 py-3 text-left text-sm text-[#202124] hover:shadow-google transition-shadow cursor-pointer"
          >
            {s}
          </button>
        ))}
      </div>

      {(status === "idle" || status === "error") && (
        <button onClick={onConnect} className="btn-primary px-8 py-3 text-base">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          Start session
        </button>
      )}
    </div>
  );
}
