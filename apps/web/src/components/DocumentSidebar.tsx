import React, { useCallback, useEffect, useRef, useState } from "react";
import type { DocRecord } from "../types/index.js";

const API = import.meta.env.VITE_API_URL ?? "";

interface DocumentSidebarProps {
  sessionId: string;
}

type ImportMode = null | "drive" | "gcs";

export function DocumentSidebar({ sessionId }: DocumentSidebarProps) {
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
      const data = await res.json() as { files: DocRecord[] };
      setDocs(data.files ?? []);
    } catch {
      // silent
    }
  }, [sessionId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  async function uploadFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported");
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
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Upload failed");
      }
      await loadDocs();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach(uploadFile);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  }

  async function handleImport() {
    if (!importValue.trim() || !importMode) return;
    setImporting(true);
    setError(null);
    try {
      const endpoint = importMode === "drive" ? "import-drive" : "import-gcs";
      const res = await fetch(`${API}/api/docs/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importValue.trim(), sessionId }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Import failed");
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

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col border-r border-google-gray-border bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-google-gray-border">
        <h2 className="text-sm font-medium text-[#202124]">Documents</h2>
        <p className="text-xs text-google-gray mt-0.5">{docs.length} file{docs.length !== 1 ? "s" : ""} connected</p>
      </div>

      {/* Upload drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mx-3 mt-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-center py-5 px-3 ${
          dragOver
            ? "border-google-blue bg-google-blue-light"
            : "border-google-gray-border hover:border-google-blue hover:bg-google-gray-light"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-google-blue">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs">Uploading…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <svg className="w-7 h-7 text-google-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-xs font-medium text-[#202124]">Drop PDF here</p>
            <p className="text-xs text-google-gray">or click to browse</p>
          </div>
        )}
      </div>

      {/* Import buttons */}
      <div className="flex gap-2 px-3 mt-2">
        <button
          onClick={() => { setImportMode(importMode === "drive" ? null : "drive"); setImportValue(""); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            importMode === "drive"
              ? "border-google-blue bg-google-blue-light text-google-blue"
              : "border-google-gray-border text-google-gray hover:bg-google-gray-light"
          }`}
        >
          <GoogleDriveIcon />
          Drive
        </button>
        <button
          onClick={() => { setImportMode(importMode === "gcs" ? null : "gcs"); setImportValue(""); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            importMode === "gcs"
              ? "border-google-blue bg-google-blue-light text-google-blue"
              : "border-google-gray-border text-google-gray hover:bg-google-gray-light"
          }`}
        >
          <GCSIcon />
          Cloud Storage
        </button>
      </div>

      {/* Import form */}
      {importMode && (
        <div className="px-3 mt-2 animate-fade-in">
          {importMode === "drive" ? (
            <div className="text-xs text-google-gray mb-1.5 leading-relaxed">
              Paste a Google Drive shareable link.<br />
              <span className="text-google-blue">File must be shared with:</span><br />
              <code className="text-[10px] bg-google-gray-light px-1 py-0.5 rounded break-all">
                talk-to-doc@gen-lang-client-0535468580.iam.gserviceaccount.com
              </code>
            </div>
          ) : (
            <div className="text-xs text-google-gray mb-1.5">
              Enter a GCS path, e.g. <code className="bg-google-gray-light px-1 rounded">gs://my-bucket/doc.pdf</code>
            </div>
          )}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={importValue}
              onChange={(e) => setImportValue(e.target.value)}
              placeholder={importMode === "drive" ? "https://drive.google.com/…" : "gs://bucket/path.pdf"}
              className="flex-1 text-xs px-3 py-1.5 border border-google-gray-border rounded-full focus:outline-none focus:border-google-blue"
              onKeyDown={(e) => { if (e.key === "Enter") handleImport(); }}
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

      {/* Error */}
      {error && (
        <div className="mx-3 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-google-red">
          {error}
        </div>
      )}

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 mt-1">
        {docs.length === 0 ? (
          <p className="text-xs text-google-gray text-center py-6">
            No documents yet.<br />Upload a PDF to get started.
          </p>
        ) : (
          docs.map((doc) => (
            <div
              key={doc.name}
              className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-google-gray-light group transition-colors"
            >
              <SourceIcon source={doc.source} />
              <span className="flex-1 text-xs text-[#202124] truncate" title={doc.filename}>
                {doc.filename}
              </span>
              <button
                onClick={() => deleteDoc(doc.name)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-100 text-google-gray hover:text-google-red transition-all"
                title="Remove"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-google-gray-border">
        <p className="text-[10px] text-google-gray leading-relaxed">
          Files are stored via Gemini Files API (48 hrs)
        </p>
      </div>
    </aside>
  );
}

function SourceIcon({ source }: { source?: string }) {
  if (source === "drive") return <GoogleDriveIcon />;
  if (source === "gcs") return <GCSIcon />;
  return (
    <svg className="w-4 h-4 text-google-red flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5V8h4.5L13 3.5zM6 20V4h5v6h6v10H6z" />
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
