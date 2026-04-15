import { useState } from "react";

const STORAGE_KEY = "gemini_api_key";

// ── Cookie / localStorage helpers (exported so App.tsx can bootstrap) ─────────

export function getApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveApiKey(key: string) {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function clearApiKey() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── Modal component ────────────────────────────────────────────────────────────

interface ApiKeyModalProps {
  open: boolean;
  onSave: (key: string) => void;
  onClose?: () => void;
  allowClose?: boolean;
}

export function ApiKeyModal({ open, onSave, onClose, allowClose = false }: ApiKeyModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter your API key.");
      return;
    }
    if (!trimmed.startsWith("AIza")) {
      setError("API key should start with 'AIza'. Get yours at aistudio.google.com");
      return;
    }
    saveApiKey(trimmed);
    onSave(trimmed);
    setValue("");
    setError("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-google-sm max-w-md w-full mx-4 p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full gemini-gradient flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-medium text-[#202124]">Gemini API Key</h2>
            <p className="text-xs text-google-gray">Stored in your browser — never sent to our servers</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-google-gray mb-5 leading-relaxed">
          Talk to Every Doc uses your own{" "}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-google-blue hover:underline"
          >
            Google AI Studio API key
          </a>{" "}
          to access Gemini Live. The key stays in your browser and is sent directly to the API — we never store it.
        </p>

        {/* Input */}
        <input
          type="password"
          placeholder="AIza..."
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="input-field w-full mb-2 font-mono text-sm"
          autoFocus
        />

        {error && <p className="text-sm text-google-red mb-1">{error}</p>}

        <p className="text-xs text-google-gray mb-5">
          Free tier: 15 req/min · Gemini 2.0 Flash Live available
        </p>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          {allowClose && onClose && (
            <button onClick={onClose} className="btn-ghost">
              Cancel
            </button>
          )}
          <button onClick={handleSave} className="btn-primary">
            Save &amp; continue
          </button>
        </div>
      </div>
    </div>
  );
}
