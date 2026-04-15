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

// ── Mermaid renderer (live diagram) ──────────────────────────────────────────

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
          ref.current.innerHTML = `<p class="text-xs text-red-500 p-4">Could not render diagram.</p>`;
      });
    idRef.current = `live-diag-${++liveCounter}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);

  return <div ref={ref} className="w-full" />;
}

// ── Live diagram panel (70%) ──────────────────────────────────────────────────

function LiveDiagramView({
  diagram,
  onClear,
  isProcessing,
  isSpeaking,
  volumeLevel,
  silentMode,
}: {
  diagram: LiveDiagram;
  onClear: () => void;
  isProcessing: boolean;
  isSpeaking: boolean;
  volumeLevel: number;
  silentMode: boolean;
}) {
  const isActive = isProcessing || isSpeaking;

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-google-gray-border flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`relative flex-shrink-0 w-8 h-8 rounded-full bg-google-blue flex items-center justify-center ${isActive ? "ring-4 ring-google-blue/20 animate-pulse" : ""}`}>
            <GcpLogo className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-google-gray uppercase tracking-wide">
              {silentMode ? "Arch suggests (silent)" : "Arch suggests"}
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
        {diagram.description && (
          <div className="flex gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-google-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[#202124] leading-relaxed">{diagram.description}</p>
          </div>
        )}
      </div>

      {/* Activity bar */}
      {isActive && (
        <div className={`flex items-center justify-center gap-1.5 py-3 border-t border-google-gray-border flex-shrink-0 ${silentMode ? "bg-purple-50" : "bg-blue-50"}`}>
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className={`w-1 rounded-full ${silentMode ? "bg-purple-500" : "bg-google-blue"}`}
              style={{ height: `${Math.max(6, volumeLevel * (0.4 + Math.sin(i * 0.9) * 0.6) * 32)}px`, animation: `thinking 0.8s ease-in-out ${i * 0.08}s infinite` }} />
          ))}
          <span className={`ml-2 text-xs font-medium ${silentMode ? "text-purple-600" : "text-google-blue"}`}>
            {silentMode ? "Listening to meeting…" : "Arch is explaining…"}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Meeting mode banner ────────────────────────────────────────────────────────

function MeetingBanner({
  isListening,
  isProcessing,
  tipCount,
  onExit,
}: {
  isListening: boolean;
  isProcessing: boolean;
  tipCount: number;
  onExit: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-purple-600 text-white flex-shrink-0">
      {/* Animated mic */}
      <div className="relative flex-shrink-0">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center bg-white/20 ${isListening ? "animate-pulse" : ""}`}>
          <MicIcon className="w-3.5 h-3.5 text-white" />
        </div>
        {isListening && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-400 border border-white" />
        )}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide">Silent Meeting Mode</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isListening ? "bg-white/20 text-white animate-pulse" : "bg-white/10 text-white/70"}`}>
            {isListening ? "● LIVE" : "● PAUSED"}
          </span>
          {isProcessing && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-200 font-medium animate-pulse">
              ⚡ Arch thinking…
            </span>
          )}
        </div>
        <p className="text-[10px] text-white/70 mt-0.5">
          Arch listens to your meeting and whispers tips on screen · {tipCount} tip{tipCount !== 1 ? "s" : ""} so far · voice muted
        </p>
      </div>

      <button
        onClick={onExit}
        className="flex-shrink-0 text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full transition-colors border border-white/20"
      >
        Exit meeting mode
      </button>
    </div>
  );
}

// ── Tip card (silent mode AI responses) ───────────────────────────────────────

function TipCard({ entry, index }: { entry: TranscriptEntry; index: number }) {
  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 overflow-hidden animate-fade-in">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 border-b border-purple-200">
        <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
          <GcpLogo className="w-2.5 h-2.5 text-white" />
        </div>
        <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide">Arch tip #{index + 1}</span>
        <span className="ml-auto text-[9px] text-purple-400">
          {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>
      <div className="px-3 py-2.5 text-sm text-[#202124] leading-relaxed whitespace-pre-wrap">
        {entry.text}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GcpExpertTab({ apiKey }: GcpExpertTabProps) {
  const [silentMode, setSilentMode] = useState(false);

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
  } = useGeminiLive(GCP_SESSION_ID, apiKey, "gcp", silentMode);

  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const inputRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;

  const isConnected = status !== "idle" && status !== "error";
  const isSpeaking = status === "speaking";
  const isProcessing = status === "processing";

  // Tips = AI assistant messages (in silent mode shown as cards)
  const aiTips = transcript.filter(
    (e) => e.role === "assistant" && !e.text.startsWith("[")
  );

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
    if (status === "idle" || status === "error") connect();
    else sendText(text);
  }, [status, connect, sendText]);

  // Toggle silent mode — reconnect if already connected
  const toggleSilentMode = useCallback(() => {
    if (isConnected) disconnect();
    setSilentMode((prev) => !prev);
  }, [isConnected, disconnect]);

  // ── Layout decision ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Meeting mode banner — only when silentMode is on */}
      {silentMode && (
        <MeetingBanner
          isListening={isListening}
          isProcessing={isProcessing}
          tipCount={aiTips.length}
          onExit={toggleSilentMode}
        />
      )}

      <div className="flex flex-1 min-h-0">
        {currentDiagram ? (
          // ── DIAGRAM MODE: 70 / 30 ─────────────────────────────────────────
          <>
            <div className="flex flex-col border-r border-google-gray-border overflow-hidden" style={{ flex: "7 0 0" }}>
              <LiveDiagramView
                diagram={currentDiagram}
                onClear={clearDiagram}
                isProcessing={isProcessing}
                isSpeaking={isSpeaking}
                volumeLevel={volumeLevel}
                silentMode={silentMode}
              />
            </div>
            <div className="flex flex-col overflow-hidden" style={{ flex: "3 0 0" }}>
              <ConversationPanel
                status={status}
                transcript={transcript}
                volumeLevel={volumeLevel}
                isListening={isListening}
                isConnected={isConnected}
                isSpeaking={isSpeaking}
                isProcessing={isProcessing}
                silentMode={silentMode}
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
                onToggleSilent={toggleSilentMode}
                compact
              />
            </div>
          </>
        ) : silentMode ? (
          // ── SILENT / MEETING MODE (no diagram yet): full tips feed ─────────
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {aiTips.length === 0 ? (
                <MeetingWelcome
                  isListening={isListening}
                  isConnected={isConnected}
                  onConnect={connect}
                  isProcessing={isProcessing}
                />
              ) : (
                <div className="max-w-3xl mx-auto space-y-3">
                  {/* User questions shown small */}
                  {transcript.map((entry) => {
                    if (entry.role === "user") {
                      return (
                        <div key={entry.id} className="flex items-start gap-2 text-xs text-google-gray">
                          <MicIcon className="w-3 h-3 flex-shrink-0 mt-0.5 text-purple-400" />
                          <span className="italic opacity-70">[Meeting audio: {entry.text}]</span>
                        </div>
                      );
                    }
                    if (entry.role === "assistant" && !entry.text.startsWith("[")) {
                      const tipIndex = aiTips.findIndex((t) => t.id === entry.id);
                      return <TipCard key={entry.id} entry={entry} index={tipIndex} />;
                    }
                    return null;
                  })}
                  {isProcessing && (
                    <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                        <GcpLogo className="w-2.5 h-2.5 text-white" />
                      </div>
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block"
                          style={{ animation: `thinking 1.4s ease-in-out ${i * 0.2}s infinite` }} />
                      ))}
                      <span className="text-xs text-purple-600">Arch is thinking…</span>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Silent mode mic bar */}
            <div className="border-t border-google-gray-border px-4 py-3 bg-white flex-shrink-0">
              <div className="flex items-center gap-3 bg-[#F8F9FA] rounded-2xl border border-google-gray-border px-4 py-2.5">
                <button
                  onClick={isConnected ? toggleMicrophone : connect}
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    isListening ? "bg-red-500 text-white animate-pulse" :
                    isConnected ? "bg-purple-100 text-purple-600 hover:bg-purple-200" :
                    "bg-google-gray-light text-google-gray"
                  }`}
                  title={isListening ? "Stop mic" : isConnected ? "Start mic" : "Connect"}
                >
                  <MicIcon className="w-4 h-4" />
                </button>

                {isListening && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <span key={i} className="w-0.5 rounded-full bg-purple-500"
                        style={{ height: `${Math.max(4, volumeLevel * (0.5 + Math.sin(i) * 0.5) * 24)}px`, transition: "height 0.05s" }} />
                    ))}
                  </div>
                )}

                <span className="text-xs text-google-gray flex-1">
                  {!isConnected
                    ? "Point mic at your meeting — Arch will whisper tips on screen"
                    : isListening
                    ? "Listening to meeting… Arch will respond silently"
                    : "Mic paused — click to resume listening"}
                </span>

                {isConnected && (
                  <button onClick={disconnect}
                    className="flex-shrink-0 text-xs text-google-red hover:bg-red-50 px-2 py-1 rounded-full border border-google-red/30">
                    Stop
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          // ── NORMAL MODE: diagram browser | chat ───────────────────────────
          <>
            <div className="w-96 flex-shrink-0 flex flex-col border-r border-google-gray-border bg-[#F8F9FA] overflow-hidden">
              <GcpDiagramPanel />
            </div>
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <ConversationPanel
                status={status}
                transcript={transcript}
                volumeLevel={volumeLevel}
                isListening={isListening}
                isConnected={isConnected}
                isSpeaking={isSpeaking}
                isProcessing={isProcessing}
                silentMode={silentMode}
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
                onToggleSilent={toggleSilentMode}
                compact={false}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Meeting welcome screen ─────────────────────────────────────────────────────

function MeetingWelcome({ isListening, isConnected, onConnect, isProcessing }: {
  isListening: boolean; isConnected: boolean; onConnect: () => void; isProcessing: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 py-12 max-w-xl mx-auto">
      {/* Animated ear / listening icon */}
      <div className={`relative w-20 h-20 mb-6 rounded-full flex items-center justify-center bg-purple-50 border-2 border-purple-200 ${isListening ? "animate-pulse" : ""}`}>
        <MicIcon className="w-9 h-9 text-purple-500" />
        {isListening && (
          <>
            <span className="absolute inset-0 rounded-full border-2 border-purple-300 animate-ping opacity-40" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
          </>
        )}
      </div>

      <h2 className="text-xl font-semibold text-[#202124] mb-2">Silent Meeting Mode</h2>
      <p className="text-sm text-google-gray leading-relaxed mb-6">
        Point your microphone at the meeting. Arch listens silently and whispers
        real-time tips, answers, and architecture diagrams — <strong>visible only to you</strong>.
      </p>

      <div className="grid grid-cols-2 gap-3 w-full mb-6 text-left">
        {[
          { icon: "🎤", label: "Hears meeting questions", desc: "via your microphone" },
          { icon: "📊", label: "Renders live diagrams", desc: "when arch. is discussed" },
          { icon: "🔇", label: "Voice is muted", desc: "only text on your screen" },
          { icon: "⚡", label: "Real-time tips", desc: "instant GCP suggestions" },
        ].map((f) => (
          <div key={f.label} className="flex items-start gap-2 bg-purple-50 rounded-xl p-3 border border-purple-100">
            <span className="text-lg">{f.icon}</span>
            <div>
              <p className="text-xs font-semibold text-[#202124]">{f.label}</p>
              <p className="text-[10px] text-google-gray">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {!isConnected && (
        <button onClick={onConnect} className="w-full justify-center rounded-2xl py-3 font-medium text-sm text-white bg-purple-600 hover:bg-purple-700 transition-colors flex items-center gap-2">
          <MicIcon className="w-4 h-4" />
          Start listening to meeting
        </button>
      )}

      {isConnected && !isListening && (
        <p className="text-sm text-purple-600 animate-pulse">Connecting mic…</p>
      )}

      {isListening && (
        <div className="flex items-center gap-2 text-purple-600">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium">Listening… Arch will respond when it hears GCP topics</span>
        </div>
      )}

      {isProcessing && (
        <p className="text-sm text-purple-600 mt-2">⚡ Arch is composing a tip…</p>
      )}
    </div>
  );
}

// ── Conversation panel (normal mode) ──────────────────────────────────────────

interface ConversationPanelProps {
  status: string;
  transcript: TranscriptEntry[];
  volumeLevel: number;
  isListening: boolean;
  isConnected: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  silentMode: boolean;
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
  onToggleSilent: () => void;
  compact: boolean;
}

function ConversationPanel({
  status, transcript, volumeLevel, isListening, isConnected, isSpeaking, isProcessing,
  silentMode, currentVoice, inputValue, inputRef, bottomRef,
  onSend, onInputChange, onToggleMic, onConnect, onDisconnect, onSetVoice, onChip,
  onToggleSilent, compact,
}: ConversationPanelProps) {
  return (
    <>
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-google-gray-border bg-white flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
            isProcessing ? "bg-purple-500 animate-pulse" :
            isSpeaking   ? "bg-google-blue animate-pulse" :
            isListening  ? "bg-google-green animate-pulse" :
            isConnected  ? "bg-google-green" :
            status === "error" ? "bg-google-red" : "bg-google-gray-border"
          }`} />
          <span className="text-xs text-google-gray truncate">
            {isProcessing ? "Arch thinking…" :
             isSpeaking   ? "Speaking…" :
             isListening  ? "Listening…" :
             isConnected  ? "Ready" : "Offline"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Silent mode toggle */}
          <button
            onClick={onToggleSilent}
            title={silentMode ? "Exit meeting mode" : "Enter silent meeting mode"}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-medium transition-all ${
              silentMode
                ? "bg-purple-600 text-white border-purple-600"
                : "border-google-gray-border text-google-gray hover:border-purple-400 hover:text-purple-600"
            }`}
          >
            {silentMode ? (
              <><MutedIcon className="w-3 h-3" />{!compact && "Meeting mode"}</>
            ) : (
              <><MutedIcon className="w-3 h-3" />{!compact && "Silent mode"}</>
            )}
          </button>

          {isConnected && !compact && (
            <select value={currentVoice} onChange={(e) => onSetVoice(e.target.value)}
              className="text-xs border border-google-gray-border rounded-full px-2 py-1 text-google-gray focus:outline-none focus:border-google-blue bg-white">
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
            <button onClick={onDisconnect}
              className="text-xs text-google-red hover:bg-red-50 px-2 py-1 rounded-full border border-google-red/30 transition-colors">
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
            {(isSpeaking || isProcessing) && <ThinkingDots compact={compact} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-google-gray-border px-2 py-2 bg-white flex-shrink-0">
        <form onSubmit={onSend}
          className="flex items-center gap-1.5 bg-[#F8F9FA] rounded-xl border border-google-gray-border px-3 py-1.5">
          <button type="button" onClick={onToggleMic}
            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              isListening ? "bg-google-red text-white animate-pulse" :
              isConnected ? "bg-google-blue/10 text-google-blue hover:bg-google-blue/20" :
              "bg-google-gray-light text-google-gray"
            }`}>
            <MicIcon className="w-3.5 h-3.5" />
          </button>

          {(isSpeaking || isProcessing) && volumeLevel > 0.05 && (
            <div className="flex items-center gap-0.5 w-6 flex-shrink-0">
              {[0.4, 0.7, 1, 0.7, 0.4].map((s, i) => (
                <span key={i} className="w-0.5 rounded-full bg-google-blue"
                  style={{ height: `${Math.max(3, volumeLevel * s * 18)}px`, animation: `thinking 0.8s ease-in-out ${i * 0.1}s infinite` }} />
              ))}
            </div>
          )}

          <input ref={inputRef} value={inputValue} onChange={(e) => onInputChange(e.target.value)}
            placeholder={!isConnected ? "Start session…" : isListening ? "Listening…" : "Ask about GCP…"}
            disabled={!isConnected}
            className="flex-1 bg-transparent border-none outline-none text-xs text-[#202124] placeholder:text-google-gray disabled:opacity-50 min-w-0" />

          <button type="submit" disabled={!isConnected || !inputValue.trim()}
            className="flex-shrink-0 p-1 rounded-full text-google-blue hover:bg-google-blue/10 disabled:opacity-30 disabled:pointer-events-none">
            <SendIcon className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function GcpWelcome({ onChip, status, onConnect, compact }: {
  onChip: (t: string) => void; status: string; onConnect: () => void; compact: boolean;
}) {
  if (compact) {
    return (
      <div className="text-center py-6 px-2">
        <p className="text-xs text-google-gray mb-3">Arch will draw diagrams here as you talk.</p>
        {(status === "idle" || status === "error") && (
          <button onClick={onConnect} className="btn-primary text-xs py-1.5 px-3 w-full justify-center">
            <MicIcon className="w-3 h-3" />Connect
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
      <p className="text-sm text-google-gray max-w-md mb-1 leading-relaxed">
        Arch will draw architecture diagrams live on your screen as you discuss.
      </p>
      <p className="text-xs text-purple-600 mb-6">
        💡 Enable <strong>Silent Mode</strong> to get real-time tips during a customer meeting
      </p>

      {(status === "idle" || status === "error") && (
        <button onClick={onConnect} className="btn-primary mb-6">
          <MicIcon className="w-4 h-4" />Start talking with Arch
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
  if (entry.text.startsWith("[")) return null;

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
function MutedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  );
}
