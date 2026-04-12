import { Router, type IRouter } from "express";
import multer from "multer";
import { uploadFile, listFiles, deleteFile } from "../rag/file-store.js";

export const manualsRouter: IRouter = Router();

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

/** Upload a PDF manual — stores it in the Gemini Files API (48-hour lifetime). */
manualsRouter.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const vesselId = (req.body.vesselId as string | undefined) ?? "default";

  try {
    console.log(`[manuals] Uploading ${req.file.originalname} for vessel ${vesselId}…`);
    const record = await uploadFile(req.file.buffer, req.file.originalname, vesselId);

    res.json({
      message: "Manual uploaded and ready for search",
      filename: record.filename,
      vesselId: record.vesselId,
      expiresAt: record.expiresAt,
      fileId: record.name,
    });
  } catch (err) {
    console.error("[manuals] Upload error:", err);
    res.status(500).json({ error: "Failed to upload PDF to Gemini Files API" });
  }
});

/** List all active manuals for a vessel. */
manualsRouter.get("/list", async (req, res) => {
  const vesselId = (req.query.vesselId as string | undefined) ?? "default";
  try {
    const files = await listFiles(vesselId);
    res.json({ files });
  } catch (err) {
    console.error("[manuals] List error:", err);
    res.status(500).json({ error: "Failed to list manuals" });
  }
});

/** Delete a manual by its Gemini file name (e.g. "files/abc123"). */
manualsRouter.delete("/:fileId", async (req, res) => {
  const name = `files/${req.params.fileId}`;
  try {
    await deleteFile(name);
    res.json({ message: "Manual deleted" });
  } catch (err) {
    console.error("[manuals] Delete error:", err);
    res.status(500).json({ error: "Failed to delete manual" });
  }
});
