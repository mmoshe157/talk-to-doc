/**
 * RAG retrieval using Gemini Files API + generateContent.
 *
 * For each active file that belongs to the vessel, we ask Gemini to extract
 * the passages most relevant to the query directly from the PDF.  No chunking,
 * no embeddings, no vector DB — Gemini reads the whole document.
 */
import { GoogleGenAI } from "@google/genai";
import { listFiles } from "./file-store.js";

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY ?? "" });

export interface ManualChunk {
  text: string;
  filename: string;
  score: number;
}

export async function searchManual(
  query: string,
  vesselId: string
): Promise<ManualChunk[]> {
  const files = await listFiles(vesselId);

  if (files.length === 0) {
    console.warn("[RAG] No active manuals for vessel:", vesselId);
    return [];
  }

  // Query all files in parallel — Gemini reads each PDF directly
  const results = await Promise.all(
    files.map(async (file): Promise<ManualChunk | null> => {
      try {
        const response = await genai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            {
              role: "user",
              parts: [
                { fileData: { fileUri: file.uri, mimeType: "application/pdf" } },
                {
                  text: `You are a maritime document search assistant.
Extract the most relevant passages from this technical document that answer the following query:

"${query}"

Rules:
- Return ONLY verbatim text found in the document
- If the document contains nothing relevant, return exactly: NO_RELEVANT_CONTENT
- Keep the response under 600 words
- Preserve all technical terms, part numbers, and measurements exactly`,
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
