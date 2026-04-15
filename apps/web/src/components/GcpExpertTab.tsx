import { useState, useRef, useEffect } from "react";
import { GcpDiagramPanel } from "./GcpDiagramPanel.js";
import { useGeminiLive } from "../hooks/useGeminiLive.js";
import type { TranscriptEntry } from "../types/index.js";

const GCP_SESSION_ID = "gcp-expert";

const GCP_TOPICS = [
  "How do I choose between Cloud Run and GKE?",
  "Explain VPC Service Controls and when to use them",
  "What's the best approach for multi-region HA on GCP?",
  "How do I optimize BigQuery costs?",
  "Explain IAM best practices for a large org",
  "How do I set up Cloud Armor for DDoS protection?",
];

interface GcpExpertTabProps {
  apiKey: string;
}

export function GcpExpertTab({ apiKey }: GcpExpertTabProps) {
  const {
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
  } = useGeminiLive(GCP_SESSION_ID, apiKey, "gcp");

  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isConnected = status !== "idle" && status !== "error";
  const isSpeaking = status === "speaking";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || !isConnected) return;
    sendText(text);
    setInputValue("");
    inputRef.current?.focus();
  };

  const handleChip = (text: string) => {
    if (status === "idle" || status === "error") {
      connect();
    } else {
      sendText(text);
    }
  };

  return (
    <div className="flex h-full min-h-0">
      {/* ── Left panel: architecture diagrams ──────────────────────────────── */}
      <div className="w-96 flex-shrink-0 flex flex-col border-r border-google-gray-border bg-[#F8F9FA] overflow-hidden">
        <GcpDiagramPanel />
      </div>

      {/* ── Right panel: Gemini Live voice chat ────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-google-gray-border bg-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-colors ${
              isSpeaking      ? "bg-google-blue animate-pulse" :
              isListening     ? "bg-google-green animate-pulse" :
              isConnected     ? "bg-google-green" :
              status === "error" ? "bg-google-red" :
              "bg-google-gray-border"
            }`} />
            <span className="text-xs text-google-gray">
              {isSpeaking ? "Arch is speaking…" :
               isListening ? "Listening…" :
               isConnected ? "Ready — ask anything" :
               "Start a session to talk with Arch"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isConnected && (
              <select
                value={currentVoice}
                onChange={(e) => setVoice(e.target.value)}
                className="text-xs border border-google-gray-border rounded-full px-3 py-1 text-google-gray focus:outline-none focus:border-google-blue bg-white"
              >
                {["Charon","Puck","Fenrir","Orus","Aoede","Kore","Leda","Zephyr"].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            )}

            {!isConnected ? (
              <button onClick={connect} className="btn-primary text-xs py-1.5 px-3">
                <MicIcon className="w-3.5 h-3.5" />
                Talk to Arch
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="text-xs btn-outline text-google-red border-google-red/30 hover:bg-red-50 py-1.5 px-3"
              >
                End session
              </button>
            )}
          </div>
        </div>

        {/* Transcript scroll area */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {transcript.length === 0 ? (
            <GcpWelcome onChip={handleChip} status={status} onConnect={connect} />
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {transcript.map((entry) => (
                <GcpMessage key={entry.id} entry={entry} />
              ))}
              {isSpeaking && <ThinkingDots />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="border-t border-google-gray-border px-4 py-3 bg-white flex-shrink-0">
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 bg-[#F8F9FA] rounded-2xl border border-google-gray-border px-4 py-2"
          >
            <button
              type="button"
              onClick={isConnected ? toggleMicrophone : connect}
              className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                isListening
                  ? "bg-google-red text-white animate-pulse"
                  : isConnected
                  ? "bg-google-blue/10 text-google-blue hover:bg-google-blue/20"
                  : "bg-google-gray-light text-google-gray hover:bg-gray-200"
              }`}
              title={isListening ? "Stop mic" : isConnected ? "Start mic" : "Connect"}
            >
              <MicIcon className="w-4 h-4" />
            </button>

            {/* Volume indicator — pulses when AI is speaking */}
            {isSpeaking && volumeLevel > 0.05 && (
              <div className="flex items-center gap-0.5 w-8 flex-shrink-0">
                {[0.4, 0.7, 1, 0.7, 0.4].map((scale, i) => (
                  <span
                    key={i}
                    className="w-0.5 rounded-full bg-google-blue"
                    style={{
                      height: `${Math.max(4, volumeLevel * scale * 24)}px`,
                      animation: `thinking 0.8s ease-in-out ${i * 0.1}s infinite`,
                    }}
                  />
                ))}
              </div>
            )}

            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                !isConnected ? "Click 'Talk to Arch' to start, or type…" :
                isListening  ? "Listening… (or type a question)" :
                               "Ask about GCP architecture, IAM, networking…"
              }
              disabled={!isConnected}
              className="flex-1 bg-transparent border-none outline-none text-sm text-[#202124] placeholder:text-google-gray disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={!isConnected || !inputValue.trim()}
              className="flex-shrink-0 p-1.5 rounded-full text-google-blue hover:bg-google-blue/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function GcpWelcome({
  onChip,
  status,
  onConnect,
}: {
  onChip: (t: string) => void;
  status: string;
  onConnect: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
      <div className="w-16 h-16 mb-5 rounded-full bg-google-blue/10 flex items-center justify-center">
        <GcpLogo className="w-9 h-9" />
      </div>
      <h2 className="text-2xl font-medium text-[#202124] mb-2">Ask Arch anything about GCP</h2>
      <p className="text-sm text-google-gray max-w-md mb-3 leading-relaxed">
        Arch is your senior GCP architect. Explore the architecture diagrams on the left,
        then ask questions — by voice or text.
      </p>
      <p className="text-xs text-google-gray mb-8 italic">
        "Click a diagram topic → ask Arch to explain it in detail"
      </p>

      {(status === "idle" || status === "error") && (
        <button onClick={onConnect} className="btn-primary mb-8">
          <MicIcon className="w-4 h-4" />
          Start talking with Arch
        </button>
      )}

      <div className="flex flex-wrap gap-2 justify-center max-w-xl">
        {GCP_TOPICS.map((topic) => (
          <button
            key={topic}
            onClick={() => onChip(topic)}
            className="text-xs px-3 py-2 rounded-full border border-google-gray-border text-google-gray hover:border-google-blue hover:text-google-blue hover:bg-blue-50 transition-all text-left"
          >
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
}

function GcpMessage({ entry }: { entry: TranscriptEntry }) {
  const isUser = entry.role === "user";
  const isToolCall = entry.text.startsWith("[Searching");

  if (isToolCall) {
    return (
      <div className="flex items-center gap-2 text-xs text-google-gray py-1">
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {entry.text}
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-google-blue flex items-center justify-center flex-shrink-0 mt-1">
          <GcpLogo className="w-4 h-4 text-white" />
        </div>
      )}
      <div
        className={`max-w-[76%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-google-blue text-white rounded-tr-sm"
            : "bg-[#F8F9FA] text-[#202124] border border-google-gray-border rounded-tl-sm"
        }`}
      >
        {entry.text}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-google-blue flex items-center justify-center flex-shrink-0 mt-1">
        <GcpLogo className="w-4 h-4 text-white" />
      </div>
      <div className="bg-[#F8F9FA] border border-google-gray-border px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-google-gray inline-block"
            style={{ animation: `thinking 1.4s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function GcpLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 19.5h20L12 2z" fill="#4285F4" opacity="0.2" />
      <path d="M12 2L2 19.5h20L12 2z" stroke="#4285F4" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="14" r="3" fill="#34A853" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}
