import { useState } from "react";
import { DocumentSidebar } from "./components/DocumentSidebar.js";
import { ChatArea } from "./components/ChatArea.js";
import { useGeminiLive } from "./hooks/useGeminiLive.js";

const SESSION_ID = "default";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  return (
    <div className="h-full flex flex-col bg-white">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-google-gray-border flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Hamburger */}
          <button
            onClick={() => setSidebarOpen((p) => !p)}
            className="p-2 rounded-full hover:bg-google-gray-light transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5 text-google-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full gemini-gradient flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 19.5h20L12 2zm0 3.5l7.5 13H4.5L12 5.5z" />
              </svg>
            </div>
            <span className="text-[#202124] font-medium text-lg">Talk to Doc</span>
          </div>
        </div>

        {/* Right controls */}
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

          {/* Voice picker */}
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

          {/* Session status dot */}
          <div className={`w-2 h-2 rounded-full transition-colors ${
            status === "ready" || status === "listening" ? "bg-google-green" :
            status === "connecting" ? "bg-google-yellow animate-pulse" :
            status === "error" ? "bg-google-red" : "bg-google-gray-border"
          }`} />
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Document Sidebar */}
        {sidebarOpen && (
          <DocumentSidebar sessionId={SESSION_ID} />
        )}

        {/* Chat Area */}
        <main className="flex-1 min-w-0 flex flex-col">
          <ChatArea
            status={status}
            transcript={transcript}
            volumeLevel={volumeLevel}
            isListening={isListening}
            onToggleMic={toggleMicrophone}
            onSendText={sendText}
            onConnect={connect}
          />
        </main>
      </div>
    </div>
  );
}
