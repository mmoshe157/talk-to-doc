import { WebSocket } from "ws";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { LiveServerMessage, Session } from "@google/genai";
import { searchManual } from "../rag/retrieval.js";

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
    | "voice_changed"
    | "diagram";
  payload?: unknown;
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function resolveVoice(requested: string): VoiceName {
  const lower = requested.toLowerCase();
  const direct = Object.keys(VOICES).find((v) => v.toLowerCase() === lower);
  if (direct) return direct as VoiceName;
  if (lower === "female" || lower === "woman") return "Aoede";
  if (lower === "male" || lower === "man") return "Charon";
  return DEFAULT_VOICE;
}

// ── System instructions ────────────────────────────────────────────────────────

function buildDocsSystemInstruction(sessionId: string, voiceName: VoiceName): string {
  const gender = VOICES[voiceName];
  return `You are a helpful AI document assistant named "Doc".
Your tone is friendly, clear, and precise.
Your current voice is "${voiceName}" (${gender}).
Session ID: ${sessionId}

Your primary capabilities:
1. Answer questions about documents the user has uploaded (PDFs, reports, manuals, etc.).
2. When the user asks about content from their files, ALWAYS call the search_documents function
   to retrieve relevant passages before answering — never guess at document contents.
3. Summarize documents, extract key points, compare sections, or find specific information.
4. Help users understand complex technical or legal language in plain terms.
5. If asked to change your voice (e.g. "use a female voice", "switch to Aoede", "more masculine"),
   call the change_voice function with the requested voice name or gender.

Behavior guidelines:
- Be concise. Bullet points and numbered steps are preferred for complex answers.
- Cite which document/source you found information in.
- If you cannot find relevant information in the documents, say so clearly.
- Do not make up facts or statistics that aren't in the uploaded documents.`;
}

function buildGcpMeetingSystemInstruction(voiceName: VoiceName): string {
  const gender = VOICES[voiceName];
  return `You are "Arch", a senior GCP architect providing real-time SILENT assistance to a Cloud Engineer who is currently in a live customer or internal meeting.

CRITICAL CONTEXT:
- Your voice audio is MUTED. The CE cannot hear you speak — only reads your text on screen.
- You are listening to the meeting through the CE's microphone.
- Your responses must appear instantly and be immediately useful.

YOUR JOB — listen to the meeting and:
1. When you hear a GCP-related question, immediately give a concise expert answer (2-4 sentences max).
2. When any architecture, system design, or service comparison is mentioned, call render_diagram right away.
3. Proactively whisper tips even when not directly asked — if you hear a suboptimal approach, suggest the better GCP way.
4. If a customer asks about pricing, mention relevant committed-use discounts or SKUs.
5. If a competitor is mentioned (AWS, Azure), briefly note the GCP equivalent.
6. If you hear confusion or a wrong assumption about GCP, silently correct it for the CE.

RESPONSE FORMAT (must be short — the CE is in a meeting):
- Lead with the key point in bold if possible
- Max 3 bullet points for complex answers
- Always prefer render_diagram over long text explanations
- Use GCP service names precisely (e.g. "Cloud Run" not "serverless containers")

Current voice: "${voiceName}" (${gender}) — though audio is muted in this mode.`;
}

function buildGcpSystemInstruction(voiceName: VoiceName): string {
  const gender = VOICES[voiceName];
  return `You are "Arch", a senior Google Cloud Platform architect and trusted advisor to Cloud Engineers.
Your current voice is "${voiceName}" (${gender}).

Your expertise covers:
- GCP core services: Compute Engine, GKE, Cloud Run, App Engine, Cloud Functions
- Data & Analytics: BigQuery, Dataflow, Pub/Sub, Dataproc, Looker
- Networking: VPC, Cloud Load Balancing, Cloud CDN, Cloud Armor, Private Service Connect
- Security & IAM: IAM roles, Org policies, VPC Service Controls, Secret Manager, BeyondCorp
- Storage: Cloud Storage, Cloud SQL, Spanner, Firestore, Bigtable, Memorystore
- Operations: Cloud Monitoring, Cloud Logging, Error Reporting, Profiler, Trace
- Cost optimization: committed use discounts, rightsizing, budgets & alerts
- Architecture patterns: microservices, event-driven, multi-region HA, disaster recovery
- Migration: lift-and-shift, re-platform, re-architect strategies

DIAGRAM RENDERING — CRITICAL RULE:
Whenever you describe, suggest, design, or explain any GCP architecture — ALWAYS call render_diagram
immediately with a Mermaid flowchart of that architecture. This includes:
- Answering "how would you design X on GCP"
- Comparing two approaches (render the recommended one)
- Explaining a GCP pattern or reference architecture
- Responding to questions about specific services that involve a system design
Use "graph TD" or "graph LR" syntax. Keep the chart focused: 5-12 nodes, clear labels.
Example of a good chart:
  graph TD
    User([User]) --> LB[Cloud Load Balancer]
    LB --> CR[Cloud Run]
    CR --> DB[(Cloud SQL)]

Behavior guidelines:
- Be direct and technical. Your audience is experienced Cloud Engineers.
- Always recommend the most appropriate GCP service for the use case with clear reasoning.
- Mention relevant limitations, quotas, or gotchas when they matter.
- Cite official GCP documentation or Well-Architected Framework when relevant.
- Suggest cost-saving alternatives when a cheaper option fits the requirement.
- If asked to change your voice, call the change_voice function.
- Keep answers focused — no filler phrases. Use bullet points for multi-step guidance.`;
}

export async function handleLiveSession(
  ws: WebSocket,
  sessionId: string,
  initialVoice: VoiceName = DEFAULT_VOICE,
  apiKey?: string,
  mode: "docs" | "gcp" = "docs",
  silent = false
) {
  const effectiveApiKey = apiKey ?? process.env.GOOGLE_AI_API_KEY ?? "";
  const genai = new GoogleGenAI({ apiKey: effectiveApiKey });

  console.log(`New Gemini Live session — sessionId: ${sessionId}, voice: ${initialVoice}, mode: ${mode}, silent: ${silent}`);

  let session: Session | null = null;
  let currentVoice = initialVoice;
  let restarting = false;

  function getSystemInstruction(voice: VoiceName): string {
    if (mode === "gcp" && silent) return buildGcpMeetingSystemInstruction(voice);
    if (mode === "gcp") return buildGcpSystemInstruction(voice);
    return buildDocsSystemInstruction(sessionId, voice);
  }

  async function startSession(voice: VoiceName) {
    currentVoice = voice;

    // Tools differ by mode — GCP mode only needs change_voice (no doc search)
    type FnDecl = {
      name: string;
      description: string;
      parameters: {
        type: Type;
        properties: Record<string, { type: Type; description: string }>;
        required: string[];
      };
    };

    const changeVoiceDecl: FnDecl = {
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
    };

    const searchDocsDecl: FnDecl = {
      name: "search_documents",
      description:
        "Search the user's uploaded documents. Call this whenever the user asks about content in their files, wants a summary, or needs specific information from their documents.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description:
              "A specific search query about the document content, e.g. 'payment terms' or 'safety procedures'",
          },
        },
        required: ["query"],
      },
    };

    const renderDiagramDecl: FnDecl = {
      name: "render_diagram",
      description:
        "Render a GCP architecture diagram on the user's screen. ALWAYS call this when describing, suggesting, or explaining any architecture or system design. Pass a valid Mermaid flowchart (graph TD or graph LR).",
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "Short descriptive title for the architecture (e.g. 'Multi-Region Cloud Run with Spanner')",
          },
          chart: {
            type: Type.STRING,
            description: "A valid Mermaid flowchart definition. Use graph TD or graph LR. Keep nodes to 5-12. No markdown fences — just the raw mermaid syntax starting with 'graph'.",
          },
          description: {
            type: Type.STRING,
            description: "One or two sentences summarising what this architecture does and why it is recommended.",
          },
        },
        required: ["title", "chart", "description"],
      },
    };

    const functionDeclarations: FnDecl[] =
      mode === "docs"
        ? [searchDocsDecl, changeVoiceDecl]
        : [renderDiagramDecl, changeVoiceDecl];

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
        systemInstruction: getSystemInstruction(voice),
        tools: [{ functionDeclarations }],
      },
      callbacks: {
        onopen: () => {
          console.log(`Gemini Live open — voice: ${voice}, mode: ${mode}`);
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
      // ── search_documents (docs mode only) ─────────────────────────────────
      if (fc.name === "search_documents") {
        const query = (fc.args as Record<string, string>)["query"] ?? "";
        console.log(`[RAG] search_documents: "${query}"`);
        send(ws, { type: "tool_call", payload: { name: "search_documents", query } });

        let resultText: string;
        try {
          const chunks = await searchManual(query, sessionId, effectiveApiKey);
          resultText =
            chunks.length > 0
              ? chunks.map((c, i) => `[Source ${i + 1}: ${c.filename}]\n${c.text}`).join("\n\n---\n\n")
              : "No relevant information found in the uploaded documents for this query.";
        } catch (err) {
          console.error("[RAG] error:", err);
          resultText = "Document search temporarily unavailable.";
        }

        session.sendToolResponse({
          functionResponses: [{ id: fc.id, name: "search_documents", response: { result: resultText } }],
        });
      }

      // ── render_diagram (gcp mode only) ────────────────────────────────────
      if (fc.name === "render_diagram") {
        const args = fc.args as Record<string, string>;
        const title = args["title"] ?? "Architecture Diagram";
        const chart = args["chart"] ?? "";
        const description = args["description"] ?? "";
        console.log(`[Diagram] render_diagram: "${title}"`);

        // Push diagram to browser — it will render it full-screen
        send(ws, { type: "diagram", payload: { title, chart, description } });

        // Acknowledge to Gemini so it continues speaking
        session.sendToolResponse({
          functionResponses: [
            {
              id: fc.id,
              name: "render_diagram",
              response: { result: "Diagram rendered on screen." },
            },
          ],
        });
      }

      // ── change_voice ───────────────────────────────────────────────────────
      if (fc.name === "change_voice") {
        const requested = (fc.args as Record<string, string>)["voice"] ?? "";
        const newVoice = resolveVoice(requested);

        if (newVoice === currentVoice) {
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

        setTimeout(async () => {
          if (!ws || ws.readyState !== WebSocket.OPEN) return;
          restarting = true;
          session?.close();
          session = null;
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

  ws.on("message", (data, isBinary) => {
    if (!session || restarting) return;

    try {
      if (isBinary) {
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
    console.log(`Browser WS closed — sessionId: ${sessionId}`);
    session?.close();
    session = null;
  });

  ws.on("error", (err) => {
    console.error("Browser WebSocket error:", err);
    session?.close();
    session = null;
  });

  try {
    await startSession(initialVoice);
  } catch (err) {
    console.error("Failed to create Gemini Live session:", err);
    send(ws, { type: "error", payload: { message: "Failed to start live session" } });
    ws.close();
  }
}
