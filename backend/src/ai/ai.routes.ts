import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { transcribeAudio, interpretMealText, AiParseError } from "./ai.service.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const textBodySchema = z.object({ text: z.string().trim().min(1).optional() });

export const aiRouter = Router();

aiRouter.post("/parse-meal", upload.single("audio"), async (req, res) => {
  const parsedBody = textBodySchema.safeParse(req.body);
  const bodyText = parsedBody.success ? parsedBody.data.text : undefined;
  const file = req.file;

  if (!file && !bodyText) {
    res.status(400).json({ error: "missing_input" });
    return;
  }

  try {
    let transcript: string | undefined;
    let textToInterpret: string;
    if (file) {
      transcript = await transcribeAudio(file.buffer, file.mimetype);
      textToInterpret = transcript;
    } else {
      textToInterpret = bodyText!;
    }
    const guess = await interpretMealText(textToInterpret);
    res.status(200).json(transcript !== undefined ? { ...guess, transcript } : guess);
  } catch (err) {
    if (err instanceof AiParseError) {
      console.error("AI meal parse failed", err);
      res.status(502).json({ error: "ai_failed" });
      return;
    }
    throw err;
  }
});
