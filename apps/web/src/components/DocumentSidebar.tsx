import React, { useCallback, useEffect, useRef, useState } from "react";
import type { DocRecord } from "../types/index.js";
import type { SessionMeta, FullSession } from "../hooks/useSessionHistory.js";

const API = import.meta.env.VITE_API_URL ?? "";

interface DocumentSidebarProps {
  sessionId: string;
  sessions: SessionMeta[];
  onLoadSession: (session: FullSession) => void;
  onDeleteSession: (id: string) => void;
}

type ImportMode = null | "drive" | "gcs" | "url";
type SidebarTab = "docs" | "history";

export function DocumentSidebar({
  sessionId,
  sessions,
  onLoadSession,
  onDeleteSession,
}: DocumentSidebarProps) {
  const [tab, setTab] = useState<SidebarTab>("docs");

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col border-r border-google-gray-border bg-white">
      {/* Tab bar */}
      <div className="flex border-b border-google-gray-border">
        {(["docs", "history"] as SidebarTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              tab === t
                ? "text-google-blue border-b-2 border-google-blue"
                : "text-google-gray hover:text-[#202124]"
            }`}
          >
            {t === "docs" ? "Documents" : "History"}
          </button>
        ))}
      </div>

      {tab === "docs" ? (
        <DocumentsTab sessionId={sessionId} />
      ) : (
        <HistoryTab
          sessions={sessions}
          onLoad={onLoadSession}
          onDelete={onDeleteSession}
        />
      )}
    </aside>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

function DocumentsTab({ sessionId }: { sessionId: string }) {
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>(null);
  const [importValue, setImportValue] = useState("");
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/docs/list?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { files: DocRecord[] };
      setDocs(data.files ?? []);
    } catch {
      // silent
    }
  }, [sessionId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  async function uploadFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported for direct upload");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("sessionId", sessionId);
      const res = await fetch(`${API}/api/docs/upload`, { method: "POST", body: form });
      if (!res.ok) {
        let msg = `Upload failed (${res.status})`;
        try {
          const ct = res.headers.get("content-type") ?? "";
          if (ct.includes("application/json")) {
            const d = (await res.json()) as { error?: string };
            msg = d.error ?? msg;
          }
        } catch { /* use default msg */ }
        throw new Error(msg);
      }
      await loadDocs();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(uploadFile);
  }

  async function handleImport() {
    if (!importValue.trim() || !importMode) return;
    setImporting(true);
    setError(null);
    const endpoint =
      importMode === "drive" ? "import-drive" :
      importMode === "gcs"   ? "import-gcs" :
                               "import-url";
    try {
      const res = await fetch(`${API}/api/docs/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importValue.trim(), sessionId }),
      });
      if (!res.ok) {
        // Safely try to parse JSON; fall back gracefully if server returned HTML
        let msg = `Request failed (${res.status})`;
        try {
          const ct = res.headers.get("content-type") ?? "";
          if (ct.includes("application/json")) {
            const d = (await res.json()) as { error?: string };
            msg = d.error ?? msg;
          } else {
            const text = await res.text();
            // Grab first meaningful line if it's not raw HTML
            const firstLine = text.split("\n").find((l) => l.trim() && !l.includes("<"));
            if (firstLine) msg = firstLine.trim();
          }
        } catch { /* use default msg */ }
        throw new Error(msg);
      }
      setImportValue("");
      setImportMode(null);
      await loadDocs();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function deleteDoc(name: string) {
    const id = name.replace("files/", "");
    try {
      await fetch(`${API}/api/docs/${encodeURIComponent(id)}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.name !== name));
    } catch {
      setError("Delete failed");
    }
  }

  const importButtons: { mode: ImportMode; icon: React.ReactNode; label: string }[] = [
    { mode: "url",   icon: <LinkIcon />,        label: "URL" },
    { mode: "drive", icon: <GoogleDriveIcon />, label: "Drive" },
    { mode: "gcs",   icon: <GCSIcon />,         label: "GCS" },
  ];

  return (
    <>
      {/* Header */}
      <div className="px-4 py-3">
        <p className="text-xs text-google-gray">{docs.length} file{docs.length !== 1 ? "s" : ""} connected</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mx-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-center py-4 px-3 ${
          dragOver ? "border-google-blue bg-google-blue-light" : "border-google-gray-border hover:border-google-blue hover:bg-google-gray-light"
        }`}
      >
        <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={(e) => { Array.from(e.target.files ?? []).forEach(uploadFile); e.target.value = ""; }} className="hidden" />
        {uploading ? (
          <div className="flex flex-col items-center gap-1.5 text-google-blue">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            <span className="text-xs">Uploading…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <svg className="w-6 h-6 text-google-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
            <p className="text-xs font-medium text-[#202124]">Drop PDF here</p>
            <p className="text-xs text-google-gray">or click to browse</p>
          </div>
        )}
      </div>

      {/* Import buttons */}
      <div className="flex gap-1.5 px-3 mt-2">
        {importButtons.map(({ mode, icon, label }) => (
          <button
            key={mode}
            onClick={() => { setImportMode(importMode === mode ? null : mode); setImportValue(""); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              importMode === mode
                ? "border-google-blue bg-google-blue-light text-google-blue"
                : "border-google-gray-border text-google-gray hover:bg-google-gray-light"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Import form */}
      {importMode && (
        <div className="px-3 mt-2 animate-fade-in">
          <ImportHint mode={importMode} />
          <div className="flex gap-1.5 mt-1.5">
            <input
              type="text"
              value={importValue}
              onChange={(e) => setImportValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleImport()}
              placeholder={
                importMode === "url"   ? "https://example.com/page" :
                importMode === "drive" ? "https://drive.google.com/…" :
                                         "gs://bucket/path.pdf"
              }
              className="flex-1 text-xs px-3 py-1.5 border border-google-gray-border rounded-full focus:outline-none focus:border-google-blue"
            />
            <button
              onClick={handleImport}
              disabled={importing || !importValue.trim()}
              className="px-3 py-1.5 bg-google-blue text-white rounded-full text-xs font-medium disabled:opacity-50 hover:bg-google-blue-dark transition-colors"
            >
              {importing ? "…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-3 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-google-red">
          {error}
        </div>
      )}

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 mt-1">
        {docs.length === 0 ? (
          <p className="text-xs text-google-gray text-center py-6">No documents yet.<br/>Upload a PDF or add a URL.</p>
        ) : (
          docs.map((doc) => (
            <div key={doc.name} className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-google-gray-light group transition-colors">
              <SourceIcon source={doc.source} />
              <span className="flex-1 text-xs text-[#202124] truncate" title={doc.filename}>
                {cleanDisplayName(doc.filename)}
              </span>
              <button
                onClick={() => deleteDoc(doc.name)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-100 text-google-gray hover:text-google-red transition-all"
                title="Remove"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-3 border-t border-google-gray-border">
        <p className="text-[10px] text-google-gray">Files stored via Gemini Files API (48 hrs)</p>
      </div>
    </>
  );
}

function cleanDisplayName(filename: string): string {
  if (filename.startsWith("url:"))   return filename.slice(4);
  if (filename.startsWith("drive:")) return filename.slice(6);
  if (filename.startsWith("gcs:"))   return filename.slice(4);
  return filename;
}

function ImportHint({ mode }: { mode: ImportMode }) {
  if (mode === "url") return (
    <p className="text-xs text-google-gray">Paste any public web page URL to extract its text.</p>
  );
  if (mode === "drive") return (
    <p className="text-xs text-google-gray leading-relaxed">
      Paste a Drive link. Share the file with:<br />
      <code className="text-[10px] bg-google-gray-light px-1 py-0.5 rounded break-all select-all">
        talk-to-doc@gen-lang-client-0535468580.iam.gserviceaccount.com
      </code>
    </p>
  );
  if (mode === "gcs") return (
    <p className="text-xs text-google-gray">Enter a GCS path: <code className="bg-google-gray-light px-1 rounded">gs://bucket/file.pdf</code></p>
  );
  return null;
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({
  sessions,
  onLoad,
  onDelete,
}: {
  sessions: SessionMeta[];
  onLoad: (s: import("../hooks/useSessionHistory.js").FullSession) => void;
  onDelete: (id: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-6">
        <svg className="w-10 h-10 text-google-gray-border" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-google-gray">No past sessions yet.<br/>Conversations are saved automatically.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
      {sessions.map((s) => (
        <HistoryItem key={s.id} session={s} onLoad={onLoad} onDelete={onDelete} />
      ))}
    </div>
  );
}

function HistoryItem({
  session,
  onLoad,
  onDelete,
}: {
  session: SessionMeta;
  onLoad: (s: import("../hooks/useSessionHistory.js").FullSession) => void;
  onDelete: (id: string) => void;
}) {
  function handleLoad() {
    onLoad({ id: session.id } as import("../hooks/useSessionHistory.js").FullSession);
  }

  const date = new Date(session.createdAt);
  const relativeDate = formatRelativeDate(date);

  return (
    <div className="group flex items-start gap-2 px-3 py-2.5 rounded-xl hover:bg-google-gray-light transition-colors cursor-pointer" onClick={handleLoad}>
      <div className="w-7 h-7 rounded-full bg-google-blue-light flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-3.5 h-3.5 text-google-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#202124] truncate">{session.title}</p>
        <p className="text-[10px] text-google-gray mt-0.5">
          {relativeDate} · {session.messageCount} message{session.messageCount !== 1 ? "s" : ""}
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-100 text-google-gray hover:text-google-red transition-all flex-shrink-0"
        title="Delete"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
    </div>
  );
}

function formatRelativeDate(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SourceIcon({ source }: { source?: string }) {
  if (source === "drive") return <GoogleDriveIcon />;
  if (source === "gcs")   return <GCSIcon />;
  if (source === "url")   return <LinkIcon />;
  return (
    <svg className="w-4 h-4 text-google-red flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5V8h4.5L13 3.5zM6 20V4h5v6h6v10H6z"/>
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="w-4 h-4 text-google-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
    </svg>
  );
}

function GoogleDriveIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 87.3 78" fill="none">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5L6.6 66.85z" fill="#0066DA"/>
      <path d="M43.65 25L29.9 0c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5A9 9 0 0 0 0 53h27.5L43.65 25z" fill="#00AC47"/>
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57.5c.8-1.4 1.2-2.95 1.2-4.5H59.8L73.55 76.8z" fill="#EA4335"/>
      <path d="M43.65 25L57.4 0H29.9L43.65 25z" fill="#00832D"/>
      <path d="M59.8 53H87.3L73.55 28.5H29.9L16.15 53h43.65z" fill="#2684FC"/>
      <path d="M73.55 28.5L59.8 53l13.75 23.8 13.75-23.8-13.75-24.3z" fill="#FFBA00"/>
    </svg>
  );
}

function GCSIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#4285F4"/>
      <path d="M7 12l5-5 5 5-5 5-5-5z" fill="white" opacity="0.8"/>
    </svg>
  );
}
