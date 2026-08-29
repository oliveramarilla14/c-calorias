import OpenAI from "openai";
import { z } from "zod";
import { config } from "../config.js";
import { MEAL_TYPES } from "../meals/meals.service.js";

export class AiParseError extends Error {}

function client(): OpenAI {
  return new OpenAI({ apiKey: config.openaiApiKey });
}

const mealGuessSchema = z.object({
  type: z.enum(MEAL_TYPES),
  description: z.string().min(1),
  calories: z.number().int().positive(),
});

export type MealGuess = z.infer<typeof mealGuessSchema>;

export async function transcribeAudio(buffer: Buffer, mimetype: string): Promise<string> {
  const file = new File([buffer], "audio.webm", { type: mimetype });
  try {
    const transcription = await client().audio.transcriptions.create({ file, model: "whisper-1" });
    return transcription.text;
  } catch (err) {
    throw new AiParseError(`transcription_failed: ${(err as Error).message}`);
  }
}

export async function interpretMealText(text: string): Promise<MealGuess> {
  let raw: string | null;
  try {
    const completion = await client().chat.completions.create({
      model: "gpt-4o-mini",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "meal_guess",
          strict: true,
          schema: {
            type: "object",
            properties: {
              type: { type: "string", enum: MEAL_TYPES },
              description: { type: "string" },
              calories: { type: "integer" },
            },
            required: ["type", "description", "calories"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Interpretás lo que alguien comió, descripto en lenguaje natural en español, y devolvés una estimación estructurada. " +
            `"type" debe ser uno de: ${MEAL_TYPES.join(", ")}, elegido según la hora del día mencionada o inferida (si no hay hora, elegí el más probable). ` +
            '"description" es una descripción breve y clara en español de lo que se comió. ' +
            '"calories" es tu mejor estimación entera de calorías totales, basada en porciones típicas.',
        },
        { role: "user", content: text },
      ],
    });
    raw = completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    throw new AiParseError(`completion_failed: ${(err as Error).message}`);
  }
  if (!raw) throw new AiParseError("empty_completion");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new AiParseError("invalid_json");
  }
  const result = mealGuessSchema.safeParse(parsedJson);
  if (!result.success) throw new AiParseError("invalid_shape");
  return result.data;
}
