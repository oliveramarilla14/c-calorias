import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { uploadToR2 } from "./r2.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

export const uploadsRouter = Router();

uploadsRouter.post("/", upload.single("photo"), async (req, res) => {
  const file = req.file;
  if (!file || !file.mimetype.startsWith("image/")) {
    res.status(400).json({ error: "invalid_file" });
    return;
  }
  const ext = file.originalname.split(".").pop() || "jpg";
  const key = `meals/${randomUUID()}.${ext}`;
  try {
    const photoUrl = await uploadToR2(file.buffer, key, file.mimetype);
    res.status(201).json({ photo_url: photoUrl });
  } catch (err) {
    console.error("R2 upload failed", err);
    res.status(502).json({ error: "upload_failed" });
  }
});
