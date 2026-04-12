import { useCallback, useEffect, useRef, useState } from "react";
import { DocumentSidebar } from "./components/DocumentSidebar.js";
import { ChatArea } from "./components/ChatArea.js";
import { useGeminiLive } from "./hooks/useGeminiLive.js";
import { useSessionHistory } from "./hooks/useSessionHistory.js";
import type { FullSession } from "./hooks/useSessionHistory.js";
import type { TranscriptEntry } from "./types/index.js";

const SESSION_ID = "default";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Live session ──────────────────────────────────────────────────────────
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
  } = useGeminiLive(SESSION_ID);

  // ── Session history ───────────────────────────────────────────────────────
  const { sessions, saveSession, loadSession, deleteSession } = useSessionHistory();

  // When the live session ends (status goes idle), auto-save the conversation
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

  // ── History view (read-only replay of a past session) ─────────────────────
  const [historyView, setHistoryView] = useState<{
    transcript: TranscriptEntry[];
    title: string;
  } | null>(null);

  const handleLoadSession = useCallback((partial: FullSession) => {
    const full = loadSession(partial.id);
    if (!full) return;
    setHistoryView({ transcript: full.transcript, title: full.title });
    // Collapse the history panel on mobile-ish widths
  }, [loadSession]);

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id);
    // If we're currently viewing the deleted session, go back to live
    setHistoryView(null);
  }, [deleteSession]);

  const exitHistory = useCallback(() => setHistoryView(null), []);

  // The chat area shows history transcript or live transcript
  const displayTranscript = historyView ? historyView.transcript : transcript;
  const isHistoryMode = !!historyView;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-google-gray-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((p) => !p)}
            className="p-2 rounded-full hover:bg-google-gray-light transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5 text-google-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full gemini-gradient flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 19.5h20L12 2zm0 3.5l7.5 13H4.5L12 5.5z" />
              </svg>
            </div>
            <span className="text-[#202124] font-medium text-lg">Talk to Doc</span>
          </div>

          {/* History breadcrumb */}
          {isHistoryMode && (
            <div className="flex items-center gap-2 text-sm text-google-gray">
              <span className="text-google-gray-border">/</span>
              <span className="truncate max-w-[200px]">{historyView.title}</span>
              <button
                onClick={exitHistory}
                className="flex items-center gap-1 text-xs text-google-blue hover:underline"
              >
                ← Back to live
              </button>
            </div>
          )}
        </div>

        {/* Right controls — only shown in live mode */}
        {!isHistoryMode && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {sidebarOpen && (
          <DocumentSidebar
            sessionId={SESSION_ID}
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
      </div>
    </div>
  );
}
