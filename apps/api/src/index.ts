import "dotenv/config";
import http from "http";
import path from "path";
import { existsSync } from "fs";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { healthRouter } from "./routes/health.js";
import { docsRouter } from "./routes/docs.js";
import { handleLiveSession, VOICES } from "./live/session.js";
import type { VoiceName } from "./live/session.js";

// In Docker: WORKDIR=/app/apps/api, web dist is at /app/apps/web/dist
// Locally: web dist might not exist (dev uses Vite dev server instead)
const WEB_DIST = path.join(process.cwd(), "../web/dist");
const SERVE_STATIC = existsSync(WEB_DIST);
if (SERVE_STATIC) {
  console.log(`Serving frontend from ${WEB_DIST}`);
} else {
  console.log("No frontend build found — API-only mode (development)");
}

const app = express();
const PORT = process.env.PORT ?? "3001";
const rawOrigins = process.env.CORS_ORIGINS ?? "http://localhost:5173";
const CORS_ORIGINS: string | boolean | string[] =
  rawOrigins === "*" ? true : rawOrigins.split(",").map((o) => o.trim());

app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json());

// Serve built frontend static assets (JS, CSS, images) when available
if (SERVE_STATIC) {
  app.use(express.static(WEB_DIST));
}

app.use("/health", healthRouter);
app.use("/api/docs", docsRouter);

// Expose available voices to frontend
app.get("/api/voices", (_req, res) => {
  res.json(
    Object.entries(VOICES).map(([name, gender]) => ({ name, gender }))
  );
});

// ── SPA fallback — all non-API requests serve index.html ─────────────────────
if (SERVE_STATIC) {
  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
      return next();
    }
    res.sendFile(path.join(WEB_DIST, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

// ── Global error handlers (always return JSON, never HTML) ───────────────────
// 404 — API route not found
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: `Route not found: ${_req.method} ${_req.path}` });
});

// 500 — unhandled errors
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message ?? "Internal server error" });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/ws/live")) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws, req) => {
  const params = new URL(req.url ?? "", `http://localhost`).searchParams;
  const sessionId = params.get("sessionId") ?? params.get("vesselId") ?? "default";
  const voice = (params.get("voice") ?? "Charon") as VoiceName;
  handleLiveSession(ws, sessionId, voice);
});

server.listen(PORT, () => {
  console.log(`Talk to Doc API running on port ${PORT}`);
});
