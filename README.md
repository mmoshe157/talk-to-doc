# Aegis Marine AI

A real-time maritime AI assistant powered by **Gemini Live** for voice conversation and **RAG** over vessel technical manuals.

## Prerequisites

- Node.js 20+
- pnpm 9+
- A [Google AI API key](https://aistudio.google.com/app/apikey) (Gemini Live + embeddings)
- A [Pinecone](https://www.pinecone.io/) account (free serverless tier works)

## Quick Start

### 1. Install dependencies

```bash
cd aegis-marine-ai
pnpm install
```

### 2. Configure environment

```bash
cp .env.example apps/api/.env
# Edit apps/api/.env and fill in your API keys
```

Required values in `apps/api/.env`:
```
GOOGLE_AI_API_KEY=...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=aegis-manuals
```

### 3. Create the Pinecone index

In your Pinecone dashboard, create a **serverless index** named `aegis-manuals` with:
- Dimensions: **768** (text-embedding-004 output size)
- Metric: **cosine**
- Cloud: AWS us-east-1 (free tier)

### 4. Run in development

```bash
pnpm dev
```

- API: http://localhost:3001
- Web: http://localhost:5173

## Usage

1. Open http://localhost:5173 in your browser.
2. Go to the **Manuals** tab and upload a PDF (engine manual, SOP, etc.).
3. Switch to the **Voice** tab, click **Start Session**, then tap the mic button.
4. Ask technical questions — Aegis will search the indexed manuals in real time.

## Architecture

```
Browser ──WS (PCM16)──► API Server ──► Gemini Live Session
                             │               │
                             │    toolCall: search_manual
                             ▼               │
                         Pinecone ◄──────────┘
                         (RAG retrieval)
```

- **Gemini Live** (`gemini-2.0-flash-live-001`) handles STT + LLM + TTS in one bidirectional stream.
- **RAG** is injected via Gemini's function-calling: the AI calls `search_manual()` mid-conversation, the server queries Pinecone, and returns relevant manual chunks.
- The server acts as a secure WebSocket proxy — API keys never reach the browser.

## Project Structure

```
aegis-marine-ai/
├── apps/
│   ├── api/              # Express + WebSocket server
│   │   └── src/
│   │       ├── live/     # Gemini Live proxy & session manager
│   │       ├── rag/      # PDF ingest, embeddings, Pinecone retrieval
│   │       └── routes/   # REST endpoints
│   └── web/              # React + Vite frontend
│       └── src/
│           ├── components/
│           ├── hooks/    # useGeminiLive (WebSocket + Web Audio)
│           └── types/
├── docker-compose.yml
└── .env.example
```

## Deployment

### Google Cloud Run (API)

```bash
cd apps/api
gcloud builds submit --tag gcr.io/YOUR_PROJECT/aegis-api
gcloud run deploy aegis-api \
  --image gcr.io/YOUR_PROJECT/aegis-api \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_AI_API_KEY=...,PINECONE_API_KEY=...
```

### Vercel (Web)

```bash
cd apps/web
vercel --prod
```

Set environment variable in Vercel: `VITE_WS_URL=wss://your-cloud-run-url/ws/live`

## Post-MVP Roadmap

- **Vision Module**: Video frame analysis with Gemini 2.0 Flash, corrosion detection
- **Telemetry**: Live AIS feed integration, NOAA weather alerts
- **Auto-Reporting**: PDF/JSON audit reports, Google Drive export
- **Offline/Edge**: Local Docker on ship's server, sync on reconnect
- **Multilingual**: Tagalog, Greek, and other maritime crew languages
