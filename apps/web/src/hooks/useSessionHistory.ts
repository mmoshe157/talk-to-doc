import { useCallback, useEffect, useState } from "react";
import type { TranscriptEntry } from "../types/index.js";

const LS_INDEX = "ttd:sessions";
const LS_PREFIX = "ttd:session:";
const MAX_SESSIONS = 50;

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: string;   // ISO
  messageCount: number;
}

export interface FullSession extends SessionMeta {
  transcript: TranscriptEntry[];
}

function readIndex(): SessionMeta[] {
  try {
    return JSON.parse(localStorage.getItem(LS_INDEX) ?? "[]") as SessionMeta[];
  } catch {
    return [];
  }
}

function writeIndex(index: SessionMeta[]) {
  localStorage.setItem(LS_INDEX, JSON.stringify(index.slice(0, MAX_SESSIONS)));
}

function sessionKey(id: string) {
  return `${LS_PREFIX}${id}`;
}

function makeTitle(transcript: TranscriptEntry[]): string {
  const first = transcript.find((e) => e.role === "user");
  if (!first) return "Session";
  const words = first.text.trim().split(/\s+/).slice(0, 6).join(" ");
  return words.length < first.text.length ? `${words}…` : words;
}

export function useSessionHistory() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);

  // Load index on mount
  useEffect(() => {
    setSessions(readIndex());
  }, []);

  /** Persist a completed conversation. Returns the saved session id. */
  const saveSession = useCallback((transcript: TranscriptEntry[]): string | null => {
    if (transcript.length === 0) return null;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const meta: SessionMeta = {
      id,
      title: makeTitle(transcript),
      createdAt: new Date().toISOString(),
      messageCount: transcript.filter((e) => e.role === "user").length,
    };

    // Store full transcript
    const full: FullSession = { ...meta, transcript };
    try {
      localStorage.setItem(sessionKey(id), JSON.stringify(full));
    } catch {
      // localStorage quota exceeded — prune oldest and retry
      const index = readIndex();
      if (index.length > 0) {
        const oldest = index[index.length - 1];
        localStorage.removeItem(sessionKey(oldest.id));
        writeIndex(index.slice(0, -1));
      }
      localStorage.setItem(sessionKey(id), JSON.stringify(full));
    }

    // Prepend to index
    const newIndex = [meta, ...readIndex()].slice(0, MAX_SESSIONS);
    writeIndex(newIndex);
    setSessions(newIndex);

    return id;
  }, []);

  /** Load a full session by id. */
  const loadSession = useCallback((id: string): FullSession | null => {
    try {
      const raw = localStorage.getItem(sessionKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as FullSession;
      // Restore Date objects in transcript
      parsed.transcript = parsed.transcript.map((e) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      }));
      return parsed;
    } catch {
      return null;
    }
  }, []);

  /** Remove a session from storage and index. */
  const deleteSession = useCallback((id: string) => {
    localStorage.removeItem(sessionKey(id));
    const newIndex = readIndex().filter((s) => s.id !== id);
    writeIndex(newIndex);
    setSessions(newIndex);
  }, []);

  return { sessions, saveSession, loadSession, deleteSession };
}
