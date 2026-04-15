import { useState, useRef, useEffect, useCallback } from "react";
import mermaid from "mermaid";
import { GcpDiagramPanel } from "./GcpDiagramPanel.js";
import { useGeminiLive } from "../hooks/useGeminiLive.js";
import type { TranscriptEntry } from "../types/index.js";
import type { LiveDiagram } from "../hooks/useGeminiLive.js";

const GCP_SESSION_ID = "gcp-expert";

const GCP_TOPICS = [
  "Design a serverless API on GCP",
  "How would you build a real-time data pipeline?",
  "Design a multi-region HA architecture",
  "How do I secure GCP with IAM and VPC SC?",
  "Compare Cloud Run vs GKE for microservices",
  "Design a cost-optimised BigQuery data warehouse",
];

interface GcpExpertTabProps {
  apiKey: string;
}

// ── Mermaid renderer (live diagram) ───────────────────────────────────────────

let liveMermaidReady = false;
let liveCounter = 0;

function initLiveMermaid() {
  if (liveMermaidReady) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      primaryColor: "#E8F0FE",
      primaryTextColor: "#202124",
      primaryBorderColor: "#4285F4",
      lineColor: "#5F6368",
      secondaryColor: "#F1F3F4",
      tertiaryColor: "#FEF7E0",
      fontFamily: "'Google Sans', 'Roboto', sans-serif",
      fontSize: "14px",
    },
    flowchart: { curve: "basis", padding: 20 },
  });
  liveMermaidReady = true;
}

function LiveMermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef(`live-diag-${++liveCounter}`);

  useEffect(() => {
    initLiveMermaid();
    const el = ref.current;
    if (!el || !chart) return;
    el.innerHTML = "";
    mermaid
      .render(idRef.current, chart)
      .then(({ svg }) => {
        if (ref.current) {
          ref.current.innerHTML = svg;
          const svgEl = ref.current.querySelector("svg");
          if (svgEl) {
            svgEl.style.width = "100%";
            svgEl.style.height = "auto";
            svgEl.style.maxHeight = "calc(100vh - 260px)";
          }
        }
      })
      .catch(() => {
        if (ref.current)
          ref.current.innerHTML = `<p class="text-xs text-red-500 p-4">Could not render diagram. Arch may retry.</p>`;
      });
    idRef.current = `live-diag-${++liveCounter}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);

  return <div ref={ref} className="w-full" />;
}

// ── Live diagram panel (70 % of screen) ──────────────────────────────────────

function LiveDiagramView({
  diagram,
  onClear,
  isSpeaking,
  volumeLevel,
}: {
  diagram: LiveDiagram;
  onClear: () => void;
  isSpeaking: boolean;
  volumeLevel: number;
}) {
  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-google-gray-border flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Speaking pulse ring */}
          <div className={`relative flex-shrink-0 w-8 h-8 rounded-full bg-google-blue flex items-center justify-center ${isSpeaking ? "ring-4 ring-google-blue/20 animate-pulse" : ""}`}>
            <GcpLogo className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-google-gray uppercase tracking-wide">
              Arch suggests
            </p>
            <h2 className="text-base font-semibold text-[#202124] truncate">{diagram.title}</h2>
          </div>
        </div>
        <button
          onClick={onClear}
          className="flex-shrink-0 flex items-center gap-1.5 text-xs text-google-gray hover:text-[#202124] hover:bg-google-gray-light px-3 py-1.5 rounded-full transition-colors border border-google-gray-border"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Dismiss
        </button>
      </div>

      {/* Diagram */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-[#F8F9FA] rounded-2xl border border-google-gray-border p-6 mb-4">
          <LiveMermaidDiagram key={diagram.chart} chart={diagram.chart} />
        </div>

        {/* Description */}
        {diagram.description && (
          <div className="flex gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-google-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[#202124] leading-relaxed">{diagram.description}</p>
          </div>
        )}
      </div>

      {/* Speaking waveform bar */}
      {isSpeaking && (
        <div className="flex items-center justify-center gap-1 py-3 border-t border-google-gray-border bg-blue-50 flex-shrink-0">
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-google-blue"
              style={{
                height: `${Math.max(6, volumeLevel * (0.4 + Math.sin(i * 0.9) * 0.6) * 32)}px`,
                animation: `thinking 0.8s ease-in-out ${i * 0.08}s infinite`,
              }}
            />
          ))}
          <span className="ml-2 text-xs text-google-blue font-medium">Arch is explaining…</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GcpExpertTab({ apiKey }: GcpExpertTabProps) {
  const {
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
  } = useGeminiLive(GCP_SESSION_ID, apiKey, "gcp");

  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const inputRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;

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

  const handleChip = useCallback((text: string) => {
    if (status === "idle" || status === "error") {
      connect();
    } else {
      sendText(text);
    }
  }, [status, connect, sendText]);

  // ── Layout decision ───────────────────────────────────────────────────────
  // When Arch sends a diagram: 70% live diagram | 30% transcript
  // Otherwise: 40% diagram browser | 60% chat

  return (
    <div className="flex h-full min-h-0">
      {currentDiagram ? (
        // ── DIAGRAM MODE: 70 / 30 split ──────────────────────────────────────
        <>
          {/* 70% — live diagram */}
          <div className="flex flex-col border-r border-google-gray-border overflow-hidden" style={{ flex: "7 0 0" }}>
            <LiveDiagramView
              diagram={currentDiagram}
              onClear={clearDiagram}
              isSpeaking={isSpeaking}
              volumeLevel={volumeLevel}
            />
          </div>

          {/* 30% — transcript + input */}
          <div className="flex flex-col overflow-hidden" style={{ flex: "3 0 0" }}>
            <TranscriptPanel
              status={status}
              transcript={transcript}
              volumeLevel={volumeLevel}
              isListening={isListening}
              isConnected={isConnected}
              isSpeaking={isSpeaking}
              currentVoice={currentVoice}
              inputValue={inputValue}
              inputRef={inputRef}
              bottomRef={bottomRef}
              onSend={handleSend}
              onInputChange={setInputValue}
              onToggleMic={isConnected ? toggleMicrophone : connect}
              onConnect={connect}
              onDisconnect={disconnect}
              onSetVoice={setVoice}
              onChip={handleChip}
              compact
            />
          </div>
        </>
      ) : (
        // ── BROWSE MODE: diagram browser left | chat right ───────────────────
        <>
          {/* Diagram browser */}
          <div className="w-96 flex-shrink-0 flex flex-col border-r border-google-gray-border bg-[#F8F9FA] overflow-hidden">
            <GcpDiagramPanel />
          </div>

          {/* Chat */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <TranscriptPanel
              status={status}
              transcript={transcript}
              volumeLevel={volumeLevel}
              isListening={isListening}
              isConnected={isConnected}
              isSpeaking={isSpeaking}
              currentVoice={currentVoice}
              inputValue={inputValue}
              inputRef={inputRef}
              bottomRef={bottomRef}
              onSend={handleSend}
              onInputChange={setInputValue}
              onToggleMic={isConnected ? toggleMicrophone : connect}
              onConnect={connect}
              onDisconnect={disconnect}
              onSetVoice={setVoice}
              onChip={handleChip}
              compact={false}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Transcript panel (reused in both layouts) ──────────────────────────────────

interface TranscriptPanelProps {
  status: string;
  transcript: TranscriptEntry[];
  volumeLevel: number;
  isListening: boolean;
  isConnected: boolean;
  isSpeaking: boolean;
  currentVoice: string;
  inputValue: string;
  inputRef: React.RefObject<HTMLInputElement>;
  bottomRef: React.RefObject<HTMLDivElement>;
  onSend: (e: React.FormEvent) => void;
  onInputChange: (v: string) => void;
  onToggleMic: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSetVoice: (v: string) => void;
  onChip: (t: string) => void;
  compact: boolean;
}

function TranscriptPanel({
  status, transcript, volumeLevel, isListening, isConnected, isSpeaking,
  currentVoice, inputValue, inputRef, bottomRef,
  onSend, onInputChange, onToggleMic, onConnect, onDisconnect, onSetVoice, onChip,
  compact,
}: TranscriptPanelProps) {
  return (
    <>
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-google-gray-border bg-white flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full transition-colors flex-shrink-0 ${
            isSpeaking   ? "bg-google-blue animate-pulse" :
            isListening  ? "bg-google-green animate-pulse" :
            isConnected  ? "bg-google-green" :
            status === "error" ? "bg-google-red" : "bg-google-gray-border"
          }`} />
          <span className="text-xs text-google-gray truncate">
            {isSpeaking ? "Speaking…" : isListening ? "Listening…" : isConnected ? "Ready" : "Offline"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isConnected && !compact && (
            <select
              value={currentVoice}
              onChange={(e) => onSetVoice(e.target.value)}
              className="text-xs border border-google-gray-border rounded-full px-2 py-1 text-google-gray focus:outline-none focus:border-google-blue bg-white"
            >
              {["Charon","Puck","Fenrir","Orus","Aoede","Kore","Leda","Zephyr"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          )}
          {!isConnected ? (
            <button onClick={onConnect} className="btn-primary text-xs py-1 px-2.5">
              <MicIcon className="w-3 h-3" />
              {!compact && "Talk to Arch"}
            </button>
          ) : (
            <button onClick={onDisconnect} className="text-xs text-google-red hover:bg-red-50 px-2 py-1 rounded-full border border-google-red/30 transition-colors">
              End
            </button>
          )}
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {transcript.length === 0 ? (
          <GcpWelcome onChip={onChip} status={status} onConnect={onConnect} compact={compact} />
        ) : (
          <div className="space-y-3">
            {transcript.map((entry) => (
              <GcpMessage key={entry.id} entry={entry} compact={compact} />
            ))}
            {isSpeaking && <ThinkingDots compact={compact} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-google-gray-border px-2 py-2 bg-white flex-shrink-0">
        <form
          onSubmit={onSend}
          className="flex items-center gap-1.5 bg-[#F8F9FA] rounded-xl border border-google-gray-border px-3 py-1.5"
        >
          <button
            type="button"
            onClick={onToggleMic}
            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              isListening ? "bg-google-red text-white animate-pulse" :
              isConnected ? "bg-google-blue/10 text-google-blue hover:bg-google-blue/20" :
              "bg-google-gray-light text-google-gray"
            }`}
          >
            <MicIcon className="w-3.5 h-3.5" />
          </button>

          {isSpeaking && volumeLevel > 0.05 && (
            <div className="flex items-center gap-0.5 w-6 flex-shrink-0">
              {[0.4, 0.7, 1, 0.7, 0.4].map((s, i) => (
                <span key={i} className="w-0.5 rounded-full bg-google-blue"
                  style={{ height: `${Math.max(3, volumeLevel * s * 18)}px`, animation: `thinking 0.8s ease-in-out ${i * 0.1}s infinite` }} />
              ))}
            </div>
          )}

          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={!isConnected ? "Start session…" : isListening ? "Listening…" : "Ask about GCP…"}
            disabled={!isConnected}
            className="flex-1 bg-transparent border-none outline-none text-xs text-[#202124] placeholder:text-google-gray disabled:opacity-50 min-w-0"
          />

          <button type="submit" disabled={!isConnected || !inputValue.trim()}
            className="flex-shrink-0 p-1 rounded-full text-google-blue hover:bg-google-blue/10 disabled:opacity-30 disabled:pointer-events-none">
            <SendIcon className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function GcpWelcome({ onChip, status, onConnect, compact }: {
  onChip: (t: string) => void; status: string; onConnect: () => void; compact: boolean;
}) {
  if (compact) {
    return (
      <div className="text-center py-6 px-2">
        <p className="text-xs text-google-gray mb-3">Start talking — Arch will draw architecture diagrams here as you discuss.</p>
        {(status === "idle" || status === "error") && (
          <button onClick={onConnect} className="btn-primary text-xs py-1.5 px-3 w-full justify-center">
            <MicIcon className="w-3 h-3" />
            Connect
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
      <div className="w-14 h-14 mb-4 rounded-full bg-google-blue/10 flex items-center justify-center">
        <GcpLogo className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-medium text-[#202124] mb-2">Ask Arch anything about GCP</h2>
      <p className="text-sm text-google-gray max-w-md mb-2 leading-relaxed">
        When Arch suggests an architecture, it will automatically render as an interactive diagram — taking over 70% of your screen.
      </p>
      <p className="text-xs text-google-gray italic mb-6">Try: "Design a serverless API on GCP"</p>

      {(status === "idle" || status === "error") && (
        <button onClick={onConnect} className="btn-primary mb-6">
          <MicIcon className="w-4 h-4" />
          Start talking with Arch
        </button>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        {GCP_TOPICS.map((topic) => (
          <button key={topic} onClick={() => onChip(topic)}
            className="text-xs px-3 py-2 rounded-full border border-google-gray-border text-google-gray hover:border-google-blue hover:text-google-blue hover:bg-blue-50 transition-all">
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
}

function GcpMessage({ entry, compact }: { entry: TranscriptEntry; compact: boolean }) {
  const isUser = entry.role === "user";
  const isToolCall = entry.text.startsWith("[Searching") || entry.text.startsWith("[render_diagram");

  if (isToolCall) return null;

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className={`rounded-full bg-google-blue flex items-center justify-center flex-shrink-0 mt-0.5 ${compact ? "w-5 h-5" : "w-7 h-7"}`}>
          <GcpLogo className={`text-white ${compact ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
        </div>
      )}
      <div className={`rounded-2xl leading-relaxed whitespace-pre-wrap ${compact ? "text-xs px-3 py-2 max-w-[85%]" : "text-sm px-3 py-2.5 max-w-[80%]"} ${
        isUser ? "bg-google-blue text-white rounded-tr-sm" : "bg-[#F8F9FA] text-[#202124] border border-google-gray-border rounded-tl-sm"
      }`}>
        {entry.text}
      </div>
    </div>
  );
}

function ThinkingDots({ compact }: { compact: boolean }) {
  return (
    <div className="flex gap-2">
      <div className={`rounded-full bg-google-blue flex items-center justify-center flex-shrink-0 ${compact ? "w-5 h-5" : "w-7 h-7"}`}>
        <GcpLogo className={`text-white ${compact ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
      </div>
      <div className="bg-[#F8F9FA] border border-google-gray-border px-3 py-2 rounded-2xl rounded-tl-sm flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-1 h-1 rounded-full bg-google-gray inline-block"
            style={{ animation: `thinking 1.4s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// Icons
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
