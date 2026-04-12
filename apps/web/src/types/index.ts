export interface Vessel {
  id: string;
  name: string;
  imo: string;
  coordinates: { lat: number; lng: number };
  destination: string;
  eta: string;
  status: string;
}

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

export interface UploadedManual {
  filename: string;
  uploadedAt: Date;
}
