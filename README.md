# Talk to Doc

> **Chat with your documents using voice or text — powered by Gemini Live AI.**

Upload PDFs, paste web URLs, connect Google Drive or Cloud Storage, then have a natural voice conversation about your files. No vector database, no embeddings — Gemini reads your documents directly.

🌐 **Live:** https://talk-to-doc-api-1085727639300.us-central1.run.app

---

## Features

- 🎙 **Voice conversation** — Gemini Live handles STT + LLM + TTS in one real-time stream
- 📄 **PDF upload** — drag-and-drop directly in the browser
- 🔗 **URL import** — paste any public web page to scrape and index its text
- 📂 **Google Drive import** — share a file with the service account, paste the link
- 🪣 **GCS import** — import from any `gs://bucket/path` your service account can read
- 🔍 **RAG search** — Gemini searches your documents mid-conversation via function calling
- 🕓 **Session history** — conversations auto-saved to localStorage, browsable and restorable
- 🔄 **Voice switching** — change voice gender/name mid-session by asking the AI

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│  React SPA · Web Audio API · useGeminiLive hook                 │
│  Mic (16 kHz PCM) ──────────────── Speaker (24 kHz PCM)        │
└────────────────────┬──────────────────────┬─────────────────────┘
                     │ HTTPS                │ WSS
                     ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Google Cloud Run  (talk-to-doc-api)                           │
│                                                                 │
│  ┌──────────────────────┐   ┌─────────────────────────────┐    │
│  │  Express REST API    │   │  WebSocket Proxy /ws/live   │    │
│  │  POST /api/docs/     │   │  Binary PCM ↔ JSON msgs     │    │
│  │   upload             │   │  Auto voice switching       │    │
│  │   import-url         │   │  Function call handler      │    │
│  │   import-drive       │   └────────────┬────────────────┘    │
│  │   import-gcs         │                │                     │
│  │  GET  /api/docs/list │   ┌────────────▼────────────────┐    │
│  │  DEL  /api/docs/:id  │   │  RAG Engine                 │    │
│  │                      │   │  fanout generateContent()   │    │
│  │  express.static      │   │  one call per file, parallel│    │
│  │  (serves React SPA)  │   └─────────────────────────────┘    │
│  └──────────────────────┘                                       │
└────────────┬──────────────────────────────────┬────────────────┘
             │                                  │
             ▼                                  ▼
┌────────────────────────┐      ┌───────────────────────────────┐
│  Gemini Files API      │      │  Gemini Live API              │
│  PDF + text/plain      │      │  gemini-3.1-flash-live-preview│
│  48-hr TTL             │      │  Real-time audio stream       │
│  sessionId::filename   │      │  inputAudioTranscription      │
│  tag for filtering     │      │  outputAudioTranscription     │
└────────────────────────┘      └───────────────────────────────┘
             │
             ▼
┌────────────────────────┐
│  Gemini Flash 2.0      │
│  generateContent()     │
│  RAG over full docs    │
│  (no embeddings)       │
└────────────────────────┘
```

### Voice Conversation Flow

```
1. User clicks "Start session"
   └─► AudioContext created (user gesture = no autoplay block)

2. WebSocket opens  wss://.../ws/live?sessionId=&voice=Charon
   └─► Server connects to Gemini Live API

3. session_ready → mic auto-activates (getUserMedia 16 kHz)
   └─► ScriptProcessorNode → binary PCM frames → WebSocket

4. Server: binary frame → sendRealtimeInput({ audio: base64 })
   └─► Gemini transcribes speech, reasons, may call search_documents()

5. search_documents() tool call:
   └─► listFiles(sessionId) → parallel generateContent(fileData, query)
   └─► relevant passages returned as tool response to Gemini

6. Gemini streams audio reply + transcript back
   └─► Browser schedules PCM via AudioContext (50 ms lookahead)
```

### Document Import Flow

```
PDF upload   → multer buffer → Gemini Files API (application/pdf)
URL import   → fetch + cheerio HTML parse → text/plain upload
Drive import → googleapis + ADC → download → Gemini Files API
GCS import   → @google-cloud/storage + ADC → download → Gemini Files API

All files tagged: sessionId::filename (displayName)
Expire automatically after 48 hours
```

---

## Project Structure

```
talk-to-doc/
├── apps/
│   ├── api/                    # Node.js 20 + TypeScript + Express
│   │   └── src/
│   │       ├── index.ts        # Server entry: Express + WS + static serving
│   │       ├── live/
│   │       │   └── session.ts  # Gemini Live proxy, function calling, voice switch
│   │       ├── rag/
│   │       │   ├── file-store.ts   # Gemini Files API CRUD
│   │       │   └── retrieval.ts    # Parallel RAG search via generateContent
│   │       └── routes/
│   │           └── docs.ts     # upload / import-url / import-drive / import-gcs
│   └── web/                    # React 18 + Vite + TailwindCSS
│       └── src/
│           ├── App.tsx         # Layout: sidebar + chat + history
│           ├── components/
│           │   ├── ChatArea.tsx        # Gemini-style chat UI
│           │   └── DocumentSidebar.tsx # Docs tab + History tab
│           ├── hooks/
│           │   ├── useGeminiLive.ts    # WebSocket + Web Audio + mic
│           │   └── useSessionHistory.ts # localStorage persistence
│           └── types/index.ts
├── apps/api/Dockerfile         # Multi-stage: builds React SPA + API together
├── cloudbuild.yaml             # Cloud Build → Artifact Registry
└── architecture.html           # Interactive architecture diagram
```

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- pnpm 9+
- A [Google AI API key](https://aistudio.google.com/app/apikey)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
# apps/api/.env
GOOGLE_AI_API_KEY=your_key_here
PORT=3001
```

### 3. Run

```bash
# Terminal 1 — API
cd apps/api && pnpm dev

# Terminal 2 — Web
cd apps/web && pnpm dev
```

- API: http://localhost:3001
- Web: http://localhost:5173

---

## Deployment (Google Cloud Run)

The frontend and API are served from a **single Cloud Run container** — no separate Vercel deployment needed.

```bash
# Build and push Docker image
gcloud builds submit --config cloudbuild.yaml --project YOUR_PROJECT

# Deploy
gcloud run deploy talk-to-doc-api \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT/aegis-containers/talk-to-doc-api:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_AI_API_KEY=...,CORS_ORIGINS=*,NODE_ENV=production"
```

The multi-stage Dockerfile:
1. Builds the React SPA (`apps/web/dist`)
2. Compiles TypeScript API (`apps/api/dist`)
3. Copies both into the runtime image
4. Express serves the SPA via `express.static` + SPA fallback

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS (Google/Gemini design) |
| Backend | Node.js 20, TypeScript, Express, `ws` |
| Voice AI | Gemini Live API (`gemini-3.1-flash-live-preview`) |
| Document AI | Gemini Flash 2.0 (`generateContent` with `fileData`) |
| File Storage | Gemini Files API (48-hr temp storage) |
| Document Import | multer, cheerio, googleapis, @google-cloud/storage |
| Deployment | Google Cloud Run, Cloud Build, Artifact Registry |
| Session History | Browser localStorage (up to 50 sessions) |

---

## Roadmap

- [ ] Multi-user sessions with persistent document libraries
- [ ] Support for DOCX, XLSX, images (Gemini multi-modal)
- [ ] Shareable session links
- [ ] Custom AI personas / system prompts per workspace
- [ ] Webhook export — push summaries to Slack, Notion, email
