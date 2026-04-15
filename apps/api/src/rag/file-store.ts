/**
 * Gemini Files API storage layer.
 *
 * PDFs are uploaded directly to the Gemini Files API (48-hour lifetime).
 * The displayName encodes `vesselId::filename` so we can filter by vessel
 * without needing a separate database.
 *
 * When files expire users simply re-upload via the UI.
 */
import { GoogleGenAI } from "@google/genai";

const SEP = "::";

export interface FileRecord {
  name: string;       // Gemini file id: "files/abc123"
  uri: string;        // https://generativelanguage.googleapis.com/v1beta/files/...
  filename: string;   // original filename, e.g. "wartsila-31.pdf"
  vesselId: string;
  expiresAt: string;  // ISO 8601
}

// ── helpers ──────────────────────────────────────────────────────────────────

function makeDisplayName(vesselId: string, filename: string) {
  return `${vesselId}${SEP}${filename}`;
}

function parseDisplayName(displayName: string): { vesselId: string; filename: string } | null {
  const idx = displayName.indexOf(SEP);
  if (idx === -1) return null;
  return { vesselId: displayName.slice(0, idx), filename: displayName.slice(idx + SEP.length) };
}

function getGenAI(apiKey?: string): GoogleGenAI {
  const key = apiKey ?? process.env.GOOGLE_AI_API_KEY ?? "";
  return new GoogleGenAI({ apiKey: key });
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Upload a buffer to the Gemini Files API and return the record.
 * Polls until the file transitions to ACTIVE.
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  vesselId: string,
  mimeType: string = "application/pdf",
  apiKey?: string
): Promise<FileRecord> {
  const genai = getGenAI(apiKey);
  const displayName = makeDisplayName(vesselId, filename);
  const blob = new Blob([buffer], { type: mimeType });

  let file = await genai.files.upload({
    file: blob,
    config: { displayName, mimeType },
  });

  // Wait for processing (typically < 2 s for PDFs)
  let attempts = 0;
  while (file.state === "PROCESSING" && attempts < 30) {
    await new Promise((r) => setTimeout(r, 2000));
    file = await genai.files.get({ name: file.name! });
    attempts++;
  }

  if (file.state !== "ACTIVE") {
    throw new Error(`File processing failed with state: ${file.state}`);
  }

  return toRecord(file, filename, vesselId);
}

/**
 * List all ACTIVE files, optionally filtered by vessel.
 * Iterates all pages so callers get the full set.
 *
 * Note: the SDK's TypeScript types declare list() → File[] but the runtime
 * returns a Pager object with { page: File[], nextPage() }.  We cast to any
 * to bridge that gap without suppressing the whole file.
 */
export async function listFiles(vesselId?: string, apiKey?: string): Promise<FileRecord[]> {
  const genai = getGenAI(apiKey);
  const records: FileRecord[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pager: any = await genai.files.list();

  while (true) {
    const page: unknown[] = Array.isArray(pager) ? pager : (pager.page ?? []);
    for (const file of page) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const f = file as any;
      if (f.state !== "ACTIVE") continue;
      const parsed = parseDisplayName(f.displayName ?? "");
      if (!parsed) continue;
      if (vesselId && parsed.vesselId !== vesselId) continue;
      records.push(toRecord(f, parsed.filename, parsed.vesselId));
    }
    // Plain array — only one page
    if (Array.isArray(pager)) break;
    // Advance to next page; Pager throws "No more pages to fetch" on the last page
    try {
      const next = await pager.nextPage?.();
      if (!next || (next.page ?? []).length === 0) break;
      pager = next;
    } catch {
      break; // reached the last page
    }
  }

  return records;
}

/** Delete a file from the Gemini Files API. */
export async function deleteFile(name: string, apiKey?: string): Promise<void> {
  const genai = getGenAI(apiKey);
  await genai.files.delete({ name });
}

// ── internal ──────────────────────────────────────────────────────────────────

function toRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  file: any,
  filename: string,
  vesselId: string
): FileRecord {
  return {
    name: file.name ?? "",
    uri: file.uri ?? "",
    filename,
    vesselId,
    expiresAt: file.expirationTime ?? "",
  };
}
