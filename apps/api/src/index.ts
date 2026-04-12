import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { healthRouter } from "./routes/health.js";
import { manualsRouter } from "./routes/manuals.js";
import { vesselsRouter } from "./routes/vessels.js";
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
app.use("/api/manuals", manualsRouter);
app.use("/api/vessels", vesselsRouter);

const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  // req.url includes query string (e.g. /ws/live?vesselId=default)
  if (req.url?.startsWith("/ws/live")) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

// Expose available voices to frontend
app.get("/api/voices", (_req, res) => {
  res.json(
    Object.entries(VOICES).map(([name, gender]) => ({ name, gender }))
  );
});

wss.on("connection", (ws, req) => {
  const params = new URL(req.url ?? "", `http://localhost`).searchParams;
  const vesselId = params.get("vesselId") ?? "default";
  const voice = (params.get("voice") ?? "Charon") as VoiceName;
  handleLiveSession(ws, vesselId, voice);
});

server.listen(PORT, () => {
  console.log(`Aegis API server running on port ${PORT}`);
});
