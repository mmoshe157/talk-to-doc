import { useState } from "react";
import { VoicePanel } from "./components/VoicePanel.js";
import { VesselInfo } from "./components/VesselInfo.js";
import { UploadPage } from "./components/UploadPage.js";
import { useGeminiLive } from "./hooks/useGeminiLive.js";

type Tab = "voice" | "manuals";

const VESSEL_ID = "default";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("voice");
  const { status, transcript, volumeLevel, isListening, currentVoice, connect, disconnect, sendText, setVoice, toggleMicrophone } =
    useGeminiLive(VESSEL_ID);

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto px-4 py-4 gap-4">
      {/* Top bar */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-aegis-blue/20 border border-aegis-blue/30 flex items-center justify-center">
            <span className="text-aegis-cyan text-lg">⚓</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Aegis Marine AI</h1>
            <p className="text-[10px] text-gray-500 font-mono">v0.1.0 · MVP</p>
          </div>
        </div>

        {/* Tab switcher */}
        <nav className="flex gap-1 bg-navy-800 rounded-lg p-1 border border-navy-700">
          {(["voice", "manuals"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                activeTab === tab
                  ? "bg-aegis-blue text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab === "voice" ? "🎙 Voice" : "📄 Manuals"}
            </button>
          ))}
        </nav>
      </header>

      {/* Main content */}
      <div className="flex-1 min-h-0 grid grid-cols-[300px,1fr] gap-4">
        {/* Left sidebar: vessel info */}
        <aside className="flex flex-col gap-4">
          <VesselInfo vesselId={VESSEL_ID} />

          <div className="card text-xs text-gray-500 space-y-1.5">
            <p className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
              How to use
            </p>
            <p>1. Click <strong className="text-gray-300">Start Session</strong> to connect.</p>
            <p>2. Tap the mic button and speak your question.</p>
            <p>3. Upload manuals in the <strong className="text-gray-300">Manuals</strong> tab to give Aegis access to your vessel's documentation.</p>
          </div>
        </aside>

        {/* Main panel */}
        <main className="min-h-0 overflow-hidden flex flex-col">
          {activeTab === "voice" ? (
            <VoicePanel
              status={status}
              transcript={transcript}
              volumeLevel={volumeLevel}
              isListening={isListening}
              currentVoice={currentVoice}
              onConnect={connect}
              onDisconnect={disconnect}
              onToggleMic={toggleMicrophone}
              onSendText={sendText}
              onSetVoice={setVoice}
            />
          ) : (
            <div className="card flex-1 overflow-y-auto">
              <UploadPage vesselId={VESSEL_ID} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
