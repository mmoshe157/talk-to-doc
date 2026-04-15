/**
 * RAG retrieval using Gemini Files API + generateContent.
 *
 * For each active file that belongs to the session, we ask Gemini to extract
 * the passages most relevant to the query directly from the document.
 * No chunking, no embeddings, no vector DB — Gemini reads the whole document.
 */
import { GoogleGenAI } from "@google/genai";
import { listFiles } from "./file-store.js";

export interface ManualChunk {
  text: string;
  filename: string;
  score: number;
}

export async function searchManual(
  query: string,
  vesselId: string,
  apiKey?: string
): Promise<ManualChunk[]> {
  const key = apiKey ?? process.env.GOOGLE_AI_API_KEY ?? "";
  const genai = new GoogleGenAI({ apiKey: key });

  const files = await listFiles(vesselId, apiKey);

  if (files.length === 0) {
    console.warn("[RAG] No active manuals for session:", vesselId);
    return [];
  }

  // Determine mime type for each file
  function mimeTypeForFile(filename: string): string {
    if (filename.startsWith("url:")) return "text/plain";
    if (filename.endsWith(".txt")) return "text/plain";
    return "application/pdf";
  }

  // Query all files in parallel — Gemini reads each file directly
  const results = await Promise.all(
    files.map(async (file): Promise<ManualChunk | null> => {
      const mimeType = mimeTypeForFile(file.filename);
      try {
        const response = await genai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            {
              role: "user",
              parts: [
                { fileData: { fileUri: file.uri, mimeType } },
                {
                  text: `You are a document search assistant.
Extract the most relevant passages from this document that answer the following query:

"${query}"

Rules:
- Return ONLY text found in the document
- If the document contains nothing relevant, return exactly: NO_RELEVANT_CONTENT
- Keep the response under 600 words
- Preserve all technical terms, numbers, and data exactly`,
                },
              ],
            },
          ],
        });

        const text =
          (response.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();

        if (!text || text === "NO_RELEVANT_CONTENT") return null;

        return { text, filename: file.filename, score: 1.0 };
      } catch (err) {
        console.error(`[RAG] Error searching ${file.filename}:`, err);
        return null;
      }
    })
  );

  return results.filter((r): r is ManualChunk => r !== null);
}
