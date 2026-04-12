import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { healthRouter } from "./routes/health.js";
import { docsRouter } from "./routes/docs.js";
import { handleLiveSession, VOICES } from "./live/session.js";
import type { VoiceName } from "./live/session.js";

const app = express();
const PORT = process.env.PORT ?? "3001";
const rawOrigins = process.env.CORS_ORIGINS ?? "http://localhost:5173";
const CORS_ORIGINS: string | boolean | string[] =
  rawOrigins === "*" ? true : rawOrigins.split(",").map((o) => o.trim());

app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json());

app.use("/health", healthRouter);
app.use("/api/docs", docsRouter);

// Expose available voices to frontend
app.get("/api/voices", (_req, res) => {
  res.json(
    Object.entries(VOICES).map(([name, gender]) => ({ name, gender }))
  );
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
