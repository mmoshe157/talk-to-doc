import React, { useCallback, useRef, useState } from "react";
import type { UploadedManual } from "../types/index.js";

interface UploadPageProps {
  vesselId: string;
}

interface UploadState {
  status: "idle" | "uploading" | "success" | "error";
  message?: string;
  progress?: number;
}

export function UploadPage({ vesselId }: UploadPageProps) {
  const [manuals, setManuals] = useState<UploadedManual[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!file.name.endsWith(".pdf")) {
      setUploadState({ status: "error", message: "Only PDF files are supported" });
      return;
    }

    setUploadState({ status: "uploading", message: `Indexing ${file.name}...`, progress: 0 });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("vesselId", vesselId);

    try {
      const base = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${base}/api/manuals/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error);
      }

      const data = (await res.json()) as {
        filename: string;
        expiresAt?: string;
      };

      setManuals((prev) => [
        { filename: data.filename, uploadedAt: new Date() },
        ...prev,
      ]);

      setUploadState({
        status: "success",
        message: `${data.filename} uploaded — ready for search`,
      });

      setTimeout(() => setUploadState({ status: "idle" }), 4000);
    } catch (err) {
      setUploadState({
        status: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [vesselId]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      e.target.value = "";
    },
    [vesselId]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Technical Manuals</h2>
        <p className="text-sm text-gray-500">
          Upload PDF manuals, SOPs, or schematics to the vessel's knowledge base.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-aegis-blue bg-aegis-blue/5"
            : "border-navy-600 hover:border-navy-500 bg-navy-800/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-navy-700 flex items-center justify-center text-2xl">
            📄
          </div>
          <div>
            <p className="text-sm font-medium text-gray-300">
              Drop a PDF here, or <span className="text-aegis-blue">browse</span>
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Engine manuals, SOPs, schematics — up to 100 MB
            </p>
          </div>
        </div>
      </div>

      {/* Upload status */}
      {uploadState.status !== "idle" && (
        <div
          className={`card flex items-center gap-3 ${
            uploadState.status === "uploading"
              ? "border-aegis-amber/30 bg-amber-900/10"
              : uploadState.status === "success"
              ? "border-aegis-green/30 bg-green-900/10"
              : "border-red-500/30 bg-red-900/10"
          }`}
        >
          {uploadState.status === "uploading" && (
            <div className="w-4 h-4 border-2 border-aegis-amber border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          {uploadState.status === "success" && <span className="text-aegis-green">✓</span>}
          {uploadState.status === "error" && <span className="text-red-400">✗</span>}
          <p
            className={`text-sm ${
              uploadState.status === "uploading"
                ? "text-amber-300"
                : uploadState.status === "success"
                ? "text-green-300"
                : "text-red-300"
            }`}
          >
            {uploadState.message}
          </p>
        </div>
      )}

      {/* Indexed manuals list */}
      {manuals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Indexed This Session
          </h3>
          {manuals.map((manual, i) => (
            <div key={i} className="card flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">📘</span>
                <div>
                  <p className="text-sm font-medium text-gray-200">{manual.filename}</p>
                  <p className="text-xs text-gray-500 font-mono">
                    Uploaded · {manual.uploadedAt.toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <span className="badge bg-aegis-green/10 text-aegis-green border border-aegis-green/20">
                Indexed
              </span>
            </div>
          ))}
        </div>
      )}

      {manuals.length === 0 && uploadState.status === "idle" && (
        <div className="text-center py-4 text-gray-600 text-sm">
          No manuals indexed in this session yet.
          <br />
          Upload a PDF to get started.
        </div>
      )}
    </div>
  );
}
