import { useCallback, useEffect, useRef, useState } from "react";
import { DocumentSidebar } from "./components/DocumentSidebar.js";
import { ChatArea } from "./components/ChatArea.js";
import { GcpExpertTab } from "./components/GcpExpertTab.js";
import { ApiKeyModal, getApiKey, saveApiKey, clearApiKey } from "./components/ApiKeyModal.js";
import { useGeminiLive } from "./hooks/useGeminiLive.js";
import { useSessionHistory } from "./hooks/useSessionHistory.js";
import type { FullSession } from "./hooks/useSessionHistory.js";
import type { TranscriptEntry } from "./types/index.js";

const SESSION_ID = "default";
type AppTab = "docs" | "gcp";

export default function App() {
  // ── API key ───────────────────────────────────────────────────────────────
  const [apiKey, setApiKeyState] = useState<string>(() => getApiKey());
  const [showKeyModal, setShowKeyModal] = useState(() => !getApiKey());
  const [showKeySettings, setShowKeySettings] = useState(false);

  const handleSaveKey = (key: string) => {
    saveApiKey(key);
    setApiKeyState(key);
    setShowKeyModal(false);
    setShowKeySettings(false);
  };

  const handleClearKey = () => {
    clearApiKey();
    setApiKeyState("");
    setShowKeyModal(true);
  };

  // ── Tab navigation ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<AppTab>("docs");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Live session (Docs tab) ───────────────────────────────────────────────
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
  } = useGeminiLive(SESSION_ID, apiKey, "docs");

  // ── Session history ───────────────────────────────────────────────────────
  const { sessions, saveSession, loadSession, deleteSession } = useSessionHistory();

  const prevStatusRef = useRef(status);
  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev !== "idle" && status === "idle" && transcriptRef.current.length > 0) {
      saveSession(transcriptRef.current);
    }
  }, [status, saveSession]);

  // ── History view ──────────────────────────────────────────────────────────
  const [historyView, setHistoryView] = useState<{
    transcript: TranscriptEntry[];
    title: string;
  } | null>(null);

  const handleLoadSession = useCallback((partial: FullSession) => {
    const full = loadSession(partial.id);
    if (!full) return;
    setHistoryView({ transcript: full.transcript, title: full.title });
  }, [loadSession]);

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id);
    setHistoryView(null);
  }, [deleteSession]);

  const exitHistory = useCallback(() => setHistoryView(null), []);

  const displayTranscript = historyView ? historyView.transcript : transcript;
  const isHistoryMode = !!historyView;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* ── API Key Modal ──────────────────────────────────────────────────── */}
      <ApiKeyModal
        open={showKeyModal && !apiKey}
        onSave={handleSaveKey}
        allowClose={false}
      />
      <ApiKeyModal
        open={showKeySettings}
        onSave={handleSaveKey}
        onClose={() => setShowKeySettings(false)}
        allowClose={true}
      />

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-google-gray-border flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Sidebar toggle (only in docs tab) */}
          {activeTab === "docs" && (
            <button
              onClick={() => setSidebarOpen((p) => !p)}
              className="p-2 rounded-full hover:bg-google-gray-light transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5 text-google-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          {/* Logo + title */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full gemini-gradient flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 19.5h20L12 2zm0 3.5l7.5 13H4.5L12 5.5z" />
              </svg>
            </div>
            <span className="text-[#202124] font-medium text-lg">Talk to Every Doc</span>
          </div>

          {/* History breadcrumb */}
          {isHistoryMode && activeTab === "docs" && (
            <div className="flex items-center gap-2 text-sm text-google-gray">
              <span className="text-google-gray-border">/</span>
              <span className="truncate max-w-[200px]">{historyView!.title}</span>
              <button onClick={exitHistory} className="flex items-center gap-1 text-xs text-google-blue hover:underline">
                ← Back to live
              </button>
            </div>
          )}
        </div>

        {/* ── Tab bar (center) ──────────────────────────────────────────────── */}
        <div className="flex items-center bg-[#F1F3F4] rounded-full p-1 gap-1">
          <TabButton
            active={activeTab === "docs"}
            onClick={() => setActiveTab("docs")}
            icon={
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            label="Documents"
          />
          <TabButton
            active={activeTab === "gcp"}
            onClick={() => setActiveTab("gcp")}
            icon={
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 19.5h20L12 2z" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
                <circle cx="12" cy="14" r="3" fill="currentColor" />
              </svg>
            }
            label="GCP Expert"
          />
        </div>

        {/* ── Right controls ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {/* Docs tab: session controls */}
          {activeTab === "docs" && !isHistoryMode && (
            <>
              {status === "idle" || status === "error" ? (
                <button onClick={connect} className="btn-primary">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Start session
                </button>
              ) : (
                <button onClick={disconnect} className="btn-outline text-google-red border-google-red/30 hover:bg-red-50">
                  End session
                </button>
              )}

              {status !== "idle" && (
                <select
                  value={currentVoice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="text-sm border border-google-gray-border rounded-full px-3 py-1.5 text-google-gray focus:outline-none focus:border-google-blue bg-white"
                >
                  {["Charon","Puck","Fenrir","Orus","Aoede","Kore","Leda","Zephyr"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              )}

              <div className={`w-2 h-2 rounded-full transition-colors ${
                status === "ready" || status === "listening" ? "bg-google-green" :
                status === "connecting" ? "bg-google-yellow animate-pulse" :
                status === "error" ? "bg-google-red" : "bg-google-gray-border"
              }`} />
            </>
          )}

          {/* Settings: API key */}
          <button
            onClick={() => setShowKeySettings(true)}
            className="p-2 rounded-full hover:bg-google-gray-light transition-colors"
            title={apiKey ? "API key saved — click to change" : "Set API key"}
          >
            <svg className={`w-5 h-5 ${apiKey ? "text-google-green" : "text-google-red"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </button>

          {apiKey && (
            <button
              onClick={handleClearKey}
              className="text-xs text-google-gray hover:text-google-red transition-colors"
              title="Clear saved API key"
            >
              Clear key
            </button>
          )}
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Docs tab */}
        {activeTab === "docs" && (
          <>
            {sidebarOpen && (
              <DocumentSidebar
                sessionId={SESSION_ID}
                apiKey={apiKey}
                sessions={sessions}
                onLoadSession={handleLoadSession}
                onDeleteSession={handleDeleteSession}
              />
            )}
            <main className="flex-1 min-w-0 flex flex-col">
              <ChatArea
                status={isHistoryMode ? "idle" : status}
                transcript={displayTranscript}
                volumeLevel={volumeLevel}
                isListening={isListening}
                isHistoryMode={isHistoryMode}
                onToggleMic={toggleMicrophone}
                onSendText={sendText}
                onConnect={connect}
                onExitHistory={exitHistory}
              />
            </main>
          </>
        )}

        {/* GCP Expert tab */}
        {activeTab === "gcp" && (
          <div className="flex-1 min-w-0 min-h-0">
            <GcpExpertTab apiKey={apiKey} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab button component ───────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
        active
          ? "bg-white text-[#202124] shadow-sm"
          : "text-google-gray hover:text-[#202124]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
