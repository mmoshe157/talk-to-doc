import { WebSocket } from "ws";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { LiveServerMessage, Session } from "@google/genai";
import { searchManual } from "../rag/retrieval.js";

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY ?? "" });

const LIVE_MODEL = "models/gemini-3.1-flash-live-preview";

// Available Gemini Live voices with gender classification
export const VOICES = {
  // Male voices
  Charon: "male",
  Puck: "male",
  Fenrir: "male",
  Orus: "male",
  // Female voices
  Aoede: "female",
  Kore: "female",
  Leda: "female",
  Zephyr: "female",
} as const;

export type VoiceName = keyof typeof VOICES;

const DEFAULT_VOICE: VoiceName = "Charon";

interface ServerMessage {
  type:
    | "audio"
    | "transcript"
    | "tool_call"
    | "interrupted"
    | "error"
    | "session_ready"
    | "voice_changed";
  payload?: unknown;
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function resolveVoice(requested: string): VoiceName {
  const lower = requested.toLowerCase();

  // Direct name match
  const direct = Object.keys(VOICES).find((v) => v.toLowerCase() === lower);
  if (direct) return direct as VoiceName;

  // Gender alias: "female" → first female voice, "male" → first male voice
  if (lower === "female" || lower === "woman") return "Aoede";
  if (lower === "male" || lower === "man") return "Charon";

  return DEFAULT_VOICE;
}

function buildSystemInstruction(vesselId: string, voiceName: VoiceName): string {
  const gender = VOICES[voiceName];
  return `You are Aegis Marine Assistant, a professional maritime engineer AI system.
Your tone is technical, concise, and safety-oriented.
Your current voice is "${voiceName}" (${gender}).

Vessel context:
- Vessel Name: MV Northern Star
- IMO Number: 9413241
- Vessel ID: ${vesselId}
- Current Location: Singapore Strait (1.2897° N, 103.8501° E)
- Destination: Port of Rotterdam
- ETA: April 25, 2026

Your responsibilities:
1. Answer technical questions about the vessel's machinery, systems, and procedures.
2. When you need information from technical manuals, SOPs, or schematics, ALWAYS call the search_manual function rather than guessing.
3. Provide step-by-step guidance for maintenance and troubleshooting tasks.
4. Identify safety hazards and cite relevant IMO safety regulations.
5. Prioritize crew safety in every response.
6. If the user asks to change your voice (e.g. "switch to female voice", "use a male voice",
   "change to Aoede"), call the change_voice function with the requested voice name or gender.

When a user describes a visual observation (corrosion, leaks, unusual readings), ask clarifying
questions about location, severity, and when it was first noticed.`;
}

export async function handleLiveSession(
  ws: WebSocket,
  vesselId: string,
  initialVoice: VoiceName = DEFAULT_VOICE
) {
  console.log(`New Gemini Live session — vessel: ${vesselId}, voice: ${initialVoice}`);

  let session: Session | null = null;
  let currentVoice = initialVoice;
  // Prevent re-entrant restarts
  let restarting = false;

  async function startSession(voice: VoiceName) {
    currentVoice = voice;

    session = await genai.live.connect({
      model: LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        systemInstruction: buildSystemInstruction(vesselId, voice),
        tools: [
          {
            functionDeclarations: [
              {
                name: "search_manual",
                description:
                  "Search the vessel's technical manuals, SOPs, and schematics. Call this whenever you need specific technical information, procedures, or specifications.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: {
                      type: Type.STRING,
                      description:
                        "A specific technical query, e.g. 'fuel bleeding procedure Wartsila 31'",
                    },
                  },
                  required: ["query"],
                },
              },
              {
                name: "change_voice",
                description:
                  'Change the assistant voice. Call this when the user asks to switch voice gender or a specific voice name. Gender aliases: "male" → Charon, "female" → Aoede.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    voice: {
                      type: Type.STRING,
                      description:
                        'Voice name or gender. Accepted values: "male", "female", "Charon", "Puck", "Fenrir", "Orus", "Aoede", "Kore", "Leda", "Zephyr"',
                    },
                  },
                  required: ["voice"],
                },
              },
            ],
          },
        ],
      },
      callbacks: {
        onopen: () => {
          console.log(`Gemini Live open — voice: ${voice}`);
          send(ws, { type: "session_ready", payload: { voice } });
        },

        onmessage: (msg: LiveServerMessage) => {
          if (msg.data) {
            send(ws, { type: "audio", payload: msg.data });
          }

          if (msg.serverContent) {
            const sc = msg.serverContent;
            if (sc.outputTranscription?.text) {
              send(ws, {
                type: "transcript",
                payload: { role: "assistant", text: sc.outputTranscription.text },
              });
            }
            if (sc.inputTranscription?.text) {
              send(ws, {
                type: "transcript",
                payload: { role: "user", text: sc.inputTranscription.text },
              });
            }
            if (sc.interrupted) {
              send(ws, { type: "interrupted" });
            }
          }

          if (msg.toolCall?.functionCalls?.length) {
            handleToolCall(msg).catch((err) =>
              console.error("Tool call handler error:", err)
            );
          }
        },

        onerror: (e: { error?: unknown; message?: string }) => {
          console.error("Gemini Live error:", e.error ?? e.message);
          send(ws, { type: "error", payload: { message: "Live session error" } });
        },

        onclose: (e: { code?: number; reason?: string }) => {
          const reason = e.reason ? ` reason: ${e.reason}` : "";
          console.log(`Gemini Live closed (code: ${e.code}${reason})`);
          // Don't send error if we're restarting due to voice change
          if (!restarting && e.code !== 1000 && e.code !== 1001) {
            send(ws, {
              type: "error",
              payload: { message: `Session closed unexpectedly (${e.code})` },
            });
          }
        },
      },
    });
  }

  async function handleToolCall(msg: LiveServerMessage) {
    const toolCall = msg.toolCall;
    if (!toolCall?.functionCalls?.length || !session) return;

    for (const fc of toolCall.functionCalls) {
      // ── search_manual ──────────────────────────────────────────────────────
      if (fc.name === "search_manual") {
        const query = (fc.args as Record<string, string>)["query"] ?? "";
        console.log(`[RAG] search_manual: "${query}"`);
        send(ws, { type: "tool_call", payload: { name: "search_manual", query } });

        let resultText: string;
        try {
          const chunks = await searchManual(query, vesselId);
          resultText =
            chunks.length > 0
              ? chunks.map((c, i) => `[Source ${i + 1}: ${c.filename}]\n${c.text}`).join("\n\n---\n\n")
              : "No relevant information found in the vessel's manuals for this query.";
        } catch (err) {
          console.error("[RAG] error:", err);
          resultText = "Manual search temporarily unavailable.";
        }

        session.sendToolResponse({
          functionResponses: [{ id: fc.id, name: "search_manual", response: { result: resultText } }],
        });
      }

      // ── change_voice ───────────────────────────────────────────────────────
      if (fc.name === "change_voice") {
        const requested = (fc.args as Record<string, string>)["voice"] ?? "";
        const newVoice = resolveVoice(requested);

        if (newVoice === currentVoice) {
          // Already using this voice — just confirm
          session.sendToolResponse({
            functionResponses: [
              {
                id: fc.id,
                name: "change_voice",
                response: { result: `Already using ${newVoice} voice.` },
              },
            ],
          });
          return;
        }

        console.log(`[Voice] Switching from ${currentVoice} → ${newVoice}`);

        // Tell the AI the switch is happening, then restart
        session.sendToolResponse({
          functionResponses: [
            {
              id: fc.id,
              name: "change_voice",
              response: {
                result: `Switching to ${newVoice} voice now. Please say a brief farewell.`,
              },
            },
          ],
        });

        // Give the model ~1.5 s to speak the farewell, then restart
        setTimeout(async () => {
          if (!ws || ws.readyState !== WebSocket.OPEN) return;
          restarting = true;
          session?.close();
          session = null;

          // Notify browser — it will update its voice indicator
          send(ws, { type: "voice_changed", payload: { voice: newVoice } });

          try {
            await startSession(newVoice);
            restarting = false;
          } catch (err) {
            console.error("Failed to restart session with new voice:", err);
            send(ws, { type: "error", payload: { message: "Failed to switch voice" } });
          }
        }, 1500);
      }
    }
  }

  // ── Forward browser → Gemini Live ─────────────────────────────────────────
  // NOTE: in the `ws` library all messages arrive as Buffer objects regardless
  // of whether they are binary or text frames. Use the `isBinary` parameter
  // (the second argument) to distinguish audio PCM bytes from JSON control msgs.
  ws.on("message", (data, isBinary) => {
    if (!session || restarting) return;

    try {
      if (isBinary) {
        // Raw PCM-16 audio from the browser microphone
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        session.sendRealtimeInput({
          audio: { data: buf.toString("base64"), mimeType: "audio/pcm;rate=16000" },
        });
      } else {
        const msg = JSON.parse((data as Buffer).toString()) as { type: string; payload?: unknown };

        if (msg.type === "text" && typeof msg.payload === "string") {
          session.sendClientContent({
            turns: [{ role: "user", parts: [{ text: msg.payload }] }],
          });
        }

        // Manual voice change from UI dropdown
        if (msg.type === "set_voice" && typeof msg.payload === "string") {
          const newVoice = resolveVoice(msg.payload);
          if (newVoice !== currentVoice) {
            restarting = true;
            session?.close();
            session = null;
            send(ws, { type: "voice_changed", payload: { voice: newVoice } });
            startSession(newVoice)
              .then(() => { restarting = false; })
              .catch((err) => {
                console.error("Failed to switch voice:", err);
                send(ws, { type: "error", payload: { message: "Failed to switch voice" } });
              });
          }
        }
      }
    } catch (err) {
      console.error("Error forwarding message to Gemini Live:", err);
    }
  });

  ws.on("close", () => {
    console.log(`Browser WS closed — vessel: ${vesselId}`);
    session?.close();
    session = null;
  });

  ws.on("error", (err) => {
    console.error("Browser WebSocket error:", err);
    session?.close();
    session = null;
  });

  // Initial session
  try {
    await startSession(initialVoice);
  } catch (err) {
    console.error("Failed to create Gemini Live session:", err);
    send(ws, { type: "error", payload: { message: "Failed to start live session" } });
    ws.close();
  }
}
