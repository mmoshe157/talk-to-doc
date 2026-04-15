import { Router, type IRouter } from "express";
import multer from "multer";
import { uploadFile, listFiles, deleteFile } from "../rag/file-store.js";

export const docsRouter: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted"));
    }
  },
});

function getApiKey(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const val = req.headers["x-api-key"];
  return typeof val === "string" ? val : undefined;
}

/** Upload a PDF — stores it in the Gemini Files API (48-hour lifetime). */
docsRouter.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const sessionId = (req.body.sessionId as string | undefined) ?? "default";
  const apiKey = getApiKey(req);
  try {
    console.log(`[docs] Uploading ${req.file.originalname} for session ${sessionId}…`);
    const record = await uploadFile(req.file.buffer, req.file.originalname, sessionId, "application/pdf", apiKey);
    res.json({
      message: "Document uploaded and ready for search",
      filename: record.filename,
      sessionId: record.vesselId,
      expiresAt: record.expiresAt,
      fileId: record.name,
      source: "upload",
    });
  } catch (err) {
    console.error("[docs] Upload error:", err);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

/** List active documents for a session. */
docsRouter.get("/list", async (req, res) => {
  const sessionId = (req.query.sessionId as string | undefined) ?? "default";
  const apiKey = getApiKey(req);
  try {
    const rawFiles = await listFiles(sessionId, apiKey);
    const files = rawFiles.map((f) => ({
      name: f.name,
      filename: f.filename,
      sessionId: f.vesselId,
      expiresAt: f.expiresAt,
      source: (f.filename.startsWith("drive:") ? "drive" : f.filename.startsWith("gcs:") ? "gcs" : f.filename.startsWith("url:") ? "url" : "upload"),
    }));
    res.json({ files });
  } catch (err) {
    console.error("[docs] List error:", err);
    res.status(500).json({ error: "Failed to list documents" });
  }
});

/** Delete a document by its Gemini file ID (e.g. "abc123" → "files/abc123"). */
docsRouter.delete("/:fileId", async (req, res) => {
  const name = `files/${req.params.fileId}`;
  const apiKey = getApiKey(req);
  try {
    await deleteFile(name, apiKey);
    res.json({ message: "Document deleted" });
  } catch (err) {
    console.error("[docs] Delete error:", err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

/** Import a web page by URL — scrapes the text content and stores it as plain text. */
docsRouter.post("/import-url", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown> | undefined;
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "default";
    const apiKey = getApiKey(req);

    if (!url) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("bad protocol");
    } catch {
      res.status(400).json({ error: "Invalid URL — must start with http:// or https://" });
      return;
    }

    console.log(`[docs] Scraping URL: ${url}`);

    // Fetch the page (30 s timeout)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 TalkToEveryDoc/1.0",
          "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      res.status(422).json({ error: `URL returned HTTP ${response.status} — cannot import` });
      return;
    }

    const contentType = response.headers.get("content-type") ?? "";
    const html = await response.text();

    let text: string;

    if (contentType.includes("text/plain")) {
      text = html;
    } else {
      const { load } = await import("cheerio");
      const $ = load(html);
      $("script, style, nav, footer, header, aside, noscript, iframe, [aria-hidden='true'], .cookie-banner, #cookie-banner").remove();
      const mainEl = $("article, main, [role=main], .content, #content, #main");
      const rawText = (mainEl.length ? mainEl : $("body")).text();
      text = rawText.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    }

    if (!text || text.length < 50) {
      res.status(422).json({ error: "Could not extract meaningful text from that URL." });
      return;
    }

    const MAX_BYTES = 500_000;
    if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
      text = Buffer.from(text).subarray(0, MAX_BYTES).toString("utf8");
    }

    const hostname = parsedUrl.hostname.replace(/^www\./, "");
    const displayName = `url:${hostname}${parsedUrl.pathname.replace(/\/$/, "") || ""}`;

    const buffer = Buffer.from(text, "utf8");
    const record = await uploadFile(buffer, displayName, sessionId, "text/plain", apiKey);

    res.json({
      message: "Web page imported and ready for search",
      filename: displayName,
      sessionId,
      expiresAt: record.expiresAt,
      fileId: record.name,
      source: "url",
      charCount: text.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[docs] URL import error:", msg);
    if (!res.headersSent) {
      res.status(500).json({ error: `URL import failed: ${msg}` });
    }
  }
});

/** Import from Google Drive — file must be shared with the Cloud Run service account. */
docsRouter.post("/import-drive", async (req, res) => {
  const { url, sessionId = "default" } = req.body as { url: string; sessionId?: string };
  const apiKey = getApiKey(req);

  if (!url) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  const match =
    url.match(/\/d\/([a-zA-Z0-9_-]+)/) ??
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (!match) {
    res.status(400).json({ error: "Could not extract file ID from Drive URL" });
    return;
  }

  const fileId = match[1];

  try {
    console.log(`[docs] Importing from Drive: ${fileId}`);
    const { google } = await import("googleapis");
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    const drive = google.drive({ version: "v3", auth });

    const meta = await drive.files.get({ fileId, fields: "name,mimeType" });
    const originalName = meta.data.name ?? `drive-${fileId}.pdf`;

    const dlRes = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    const buffer = Buffer.from(dlRes.data as ArrayBuffer);
    const displayName = `drive:${originalName}`;
    const record = await uploadFile(buffer, displayName, sessionId, "application/pdf", apiKey);

    res.json({
      message: "Drive document imported and ready for search",
      filename: displayName,
      sessionId,
      expiresAt: record.expiresAt,
      fileId: record.name,
      source: "drive",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[docs] Drive import error:", msg);
    res.status(500).json({ error: `Drive import failed: ${msg}` });
  }
});

/** Import from Google Cloud Storage — gs://bucket/path.pdf */
docsRouter.post("/import-gcs", async (req, res) => {
  const { url, sessionId = "default" } = req.body as { url: string; sessionId?: string };
  const apiKey = getApiKey(req);

  if (!url) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  const gcsMatch = url.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!gcsMatch) {
    res.status(400).json({ error: "Invalid GCS URL — expected format: gs://bucket/path.pdf" });
    return;
  }

  const [, bucketName, filePath] = gcsMatch;
  const filename = filePath.split("/").pop() ?? filePath;

  try {
    console.log(`[docs] Importing from GCS: ${url}`);
    const { Storage } = await import("@google-cloud/storage");
    const storage = new Storage();
    const [fileBuffer] = await storage.bucket(bucketName).file(filePath).download();

    const displayName = `gcs:${filename}`;
    const record = await uploadFile(fileBuffer as Buffer, displayName, sessionId, "application/pdf", apiKey);

    res.json({
      message: "GCS document imported and ready for search",
      filename: displayName,
      sessionId,
      expiresAt: record.expiresAt,
      fileId: record.name,
      source: "gcs",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[docs] GCS import error:", msg);
    res.status(500).json({ error: `GCS import failed: ${msg}` });
  }
});
