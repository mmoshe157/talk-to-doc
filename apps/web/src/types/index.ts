export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

export type LiveSessionStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "listening"
  | "speaking"
  | "error";

export interface DocRecord {
  name: string;       // Gemini file name, e.g. "files/abc123"
  filename: string;
  sessionId: string;
  expiresAt: string;
  source?: "upload" | "drive" | "gcs";
}
