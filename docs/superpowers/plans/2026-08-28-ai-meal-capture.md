# AI Meal Capture (voice / natural language) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user record audio or type a free-text sentence describing what they ate, have OpenAI transcribe/interpret it into a structured meal guess (type, description, calories), and prefill the existing meal form for review before saving.

**Architecture:** A new backend endpoint (`POST /api/ai/parse-meal`) wraps two OpenAI calls (Whisper transcription, then a structured-JSON chat completion) behind a small service module. A new frontend modal (`AiMealCapture`) records audio via `MediaRecorder` or accepts typed text, calls that endpoint, and hands the result to the existing `MealSheet` as a prefilled draft — the existing create/update flow is untouched.

**Tech Stack:** Express + zod + multer (backend, existing patterns), `openai` npm SDK (new), React 19 + `MediaRecorder` Web API (frontend, existing patterns).

**Spec:** `docs/superpowers/specs/2026-08-28-ai-meal-capture-design.md`

## Global Constraints

- New required env var `OPENAI_API_KEY` (no default, follows `required()` pattern in `config.ts`).
- Audio upload limit: 8MB (same as `uploads.routes.ts`), recording auto-stops client-side at 60s.
- No dedicated rate limiting added for this endpoint (per spec — low volume, personal app).
- All AI-facing copy and estimated descriptions are in Spanish, matching the rest of the app.
- The AI result is **never** saved automatically — it only prefills `MealSheet`, which still requires the user to tap "Guardar".
- `MealSheet`'s existing edit flow (`meal` prop) must be unaffected by the new `draft` prop.

---

### Task 1: Backend — `ai.service.ts` (OpenAI transcription + interpretation)

**Files:**
- Modify: `backend/src/config.ts`
- Modify: `backend/.env.example`
- Modify: `backend/package.json` (add `openai` dependency)
- Create: `backend/src/ai/ai.service.ts`
- Test: `backend/test/ai.service.test.ts`

**Interfaces:**
- Produces: `transcribeAudio(buffer: Buffer, mimetype: string): Promise<string>`, `interpretMealText(text: string): Promise<MealGuess>` where `MealGuess = { type: MealType; description: string; calories: number }`, and `class AiParseError extends Error`. Later tasks (Task 2) import these three from `../ai/ai.service.js`.

- [ ] **Step 1: Install the `openai` dependency**

Run: `cd backend && npm install openai@^7.8.0`

- [ ] **Step 2: Add `OPENAI_API_KEY` to config and `.env.example`**

In `backend/src/config.ts`, add a new getter alongside the existing ones (e.g. after `r2PublicUrl`):

```ts
  get openaiApiKey() {
    return required("OPENAI_API_KEY");
  },
```

In `backend/.env.example`, add a new line at the end:

```
OPENAI_API_KEY=
```

- [ ] **Step 3: Write the failing unit tests for `ai.service.ts`**

Create `backend/test/ai.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { transcriptionsCreateMock, completionsCreateMock } = vi.hoisted(() => {
  const transcriptionsCreateMock = vi.fn();
  const completionsCreateMock = vi.fn();
  return { transcriptionsCreateMock, completionsCreateMock };
});

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: { transcriptions: { create: transcriptionsCreateMock } },
    chat: { completions: { create: completionsCreateMock } },
  })),
}));

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

const { transcribeAudio, interpretMealText, AiParseError } = await import("../src/ai/ai.service.js");

beforeEach(() => {
  transcriptionsCreateMock.mockReset();
  completionsCreateMock.mockReset();
});

describe("transcribeAudio", () => {
  it("returns the transcribed text", async () => {
    transcriptionsCreateMock.mockResolvedValue({ text: "comí una milanesa con papas" });
    const text = await transcribeAudio(Buffer.from("fake-audio"), "audio/webm");
    expect(text).toBe("comí una milanesa con papas");
    expect(transcriptionsCreateMock).toHaveBeenCalledOnce();
  });

  it("throws AiParseError when the OpenAI call fails", async () => {
    transcriptionsCreateMock.mockRejectedValue(new Error("network down"));
    await expect(transcribeAudio(Buffer.from("fake-audio"), "audio/webm")).rejects.toBeInstanceOf(AiParseError);
  });
});

describe("interpretMealText", () => {
  it("parses a well-formed structured completion", async () => {
    completionsCreateMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ type: "Almuerzo", description: "Milanesa con papas fritas", calories: 750 }),
          },
        },
      ],
    });
    const guess = await interpretMealText("comí una milanesa con papas fritas");
    expect(guess).toEqual({ type: "Almuerzo", description: "Milanesa con papas fritas", calories: 750 });
  });

  it("throws AiParseError when the completion fails", async () => {
    completionsCreateMock.mockRejectedValue(new Error("quota exceeded"));
    await expect(interpretMealText("comí algo")).rejects.toBeInstanceOf(AiParseError);
  });

  it("throws AiParseError when the response doesn't match the expected shape", async () => {
    completionsCreateMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "NoExiste", description: "x", calories: "mucho" }) } }],
    });
    await expect(interpretMealText("comí algo")).rejects.toBeInstanceOf(AiParseError);
  });

  it("throws AiParseError when the completion has no content", async () => {
    completionsCreateMock.mockResolvedValue({ choices: [{ message: {} }] });
    await expect(interpretMealText("comí algo")).rejects.toBeInstanceOf(AiParseError);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd backend && npx vitest run test/ai.service.test.ts`
Expected: FAIL with "Cannot find module '../src/ai/ai.service.js'" (or similar resolution error).

- [ ] **Step 5: Implement `ai.service.ts`**

Create `backend/src/ai/ai.service.ts`:

```ts
import OpenAI from "openai";
import { z } from "zod";
import { config } from "../config.js";
import { MEAL_TYPES } from "../meals/meals.service.js";

export class AiParseError extends Error {}

const client = new OpenAI({ apiKey: config.openaiApiKey });

const mealGuessSchema = z.object({
  type: z.enum(MEAL_TYPES),
  description: z.string().min(1),
  calories: z.number().int().positive(),
});

export type MealGuess = z.infer<typeof mealGuessSchema>;

export async function transcribeAudio(buffer: Buffer, mimetype: string): Promise<string> {
  const file = new File([buffer], "audio.webm", { type: mimetype });
  try {
    const transcription = await client.audio.transcriptions.create({ file, model: "whisper-1" });
    return transcription.text;
  } catch (err) {
    throw new AiParseError(`transcription_failed: ${(err as Error).message}`);
  }
}

export async function interpretMealText(text: string): Promise<MealGuess> {
  let raw: string | null;
  try {
    const completion = await client.chat.completions.create({
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && npx vitest run test/ai.service.test.ts`
Expected: PASS (all 6 tests)

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/config.ts .env.example package.json package-lock.json src/ai/ai.service.ts test/ai.service.test.ts
git commit -m "Add ai.service.ts for OpenAI transcription and meal interpretation"
```

---

### Task 2: Backend — `ai.routes.ts` and mounting

**Files:**
- Create: `backend/src/ai/ai.routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/test/ai.routes.test.ts`

**Interfaces:**
- Consumes: `transcribeAudio`, `interpretMealText`, `AiParseError` from `../ai/ai.service.js` (Task 1).
- Produces: `aiRouter` (Express `Router`), mounted at `/api/ai` behind `requireAuth`, exposing `POST /api/ai/parse-meal`. Response shape on success: `{ type: MealType; description: string; calories: number; transcript?: string }`.

- [ ] **Step 1: Write the failing route tests**

Create `backend/test/ai.routes.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../src/ai/ai.service.js", async () => {
  const actual = await vi.importActual<typeof import("../src/ai/ai.service.js")>("../src/ai/ai.service.js");
  return {
    ...actual,
    transcribeAudio: vi.fn(),
    interpretMealText: vi.fn(),
  };
});

const { transcribeAudio, interpretMealText } = await import("../src/ai/ai.service.js");
const { authedAgent } = await import("./helpers/testApp.js");

describe("POST /api/ai/parse-meal", () => {
  it("requires auth", async () => {
    const { app } = await authedAgent();
    const request = (await import("supertest")).default;
    const res = await request(app).post("/api/ai/parse-meal").send({ text: "comí algo" });
    expect(res.status).toBe(401);
  });

  it("interprets typed text directly, without transcribing", async () => {
    (interpretMealText as any).mockResolvedValue({ type: "Almuerzo", description: "Milanesa con papas", calories: 750 });
    const { agent } = await authedAgent();
    const res = await agent.post("/api/ai/parse-meal").send({ text: "comí una milanesa con papas" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: "Almuerzo", description: "Milanesa con papas", calories: 750 });
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("transcribes audio then interprets the transcript", async () => {
    (transcribeAudio as any).mockResolvedValue("comí una ensalada");
    (interpretMealText as any).mockResolvedValue({ type: "Cena", description: "Ensalada", calories: 300 });
    const { agent } = await authedAgent();
    const res = await agent
      .post("/api/ai/parse-meal")
      .attach("audio", Buffer.from("fake-audio-bytes"), { filename: "audio.webm", contentType: "audio/webm" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: "Cena", description: "Ensalada", calories: 300, transcript: "comí una ensalada" });
    expect(interpretMealText).toHaveBeenCalledWith("comí una ensalada");
  });

  it("returns 400 when neither audio nor text is provided", async () => {
    const { agent } = await authedAgent();
    const res = await agent.post("/api/ai/parse-meal");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_input");
  });

  it("returns 502 when the AI call fails", async () => {
    const { AiParseError } = await import("../src/ai/ai.service.js");
    (interpretMealText as any).mockRejectedValue(new AiParseError("boom"));
    const { agent } = await authedAgent();
    const res = await agent.post("/api/ai/parse-meal").send({ text: "comí algo" });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("ai_failed");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run test/ai.routes.test.ts`
Expected: FAIL with "Cannot find module '../src/ai/ai.routes.js'" (route not mounted / doesn't exist yet).

- [ ] **Step 3: Implement `ai.routes.ts`**

Create `backend/src/ai/ai.routes.ts`:

```ts
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
```

- [ ] **Step 4: Mount the router in `app.ts`**

In `backend/src/app.ts`, add the import near the other route imports:

```ts
import { aiRouter } from "./ai/ai.routes.js";
```

And mount it next to the other protected routers:

```ts
  app.use("/api/ai", requireAuth, aiRouter);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx vitest run test/ai.routes.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 6: Run the full backend suite to check for regressions**

Run: `cd backend && npx vitest run`
Expected: PASS (all existing + new tests)

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/ai/ai.routes.ts src/app.ts test/ai.routes.test.ts
git commit -m "Add POST /api/ai/parse-meal endpoint"
```

---

### Task 3: Frontend — `AiMealDraft` type and `api.ts` client methods

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`

**Interfaces:**
- Produces: `interface AiMealDraft { type: MealType; description: string; calories: number; transcript?: string }` in `types.ts`; `api.parseMealFromAudio(blob: Blob): Promise<AiMealDraft>` and `api.parseMealFromText(text: string): Promise<AiMealDraft>` in `api.ts`. Consumed by Task 4 and Task 5.

- [ ] **Step 1: Add `AiMealDraft` to `types.ts`**

In `frontend/src/types.ts`, add after the `Meal` interface:

```ts
export interface AiMealDraft {
  type: MealType;
  description: string;
  calories: number;
  transcript?: string;
}
```

- [ ] **Step 2: Add client methods to `api.ts`**

In `frontend/src/api.ts`, update the type import at the top:

```ts
import type { AiMealDraft, Meal, MealType, Weight, WeeklySummary } from "./types";
```

Add two new methods to the `api` object, after `uploadPhoto`:

```ts
  parseMealFromAudio: (blob: Blob) => {
    const form = new FormData();
    form.append("audio", blob, "audio.webm");
    return request<AiMealDraft>("/ai/parse-meal", { method: "POST", body: form });
  },

  parseMealFromText: (text: string) => {
    const form = new FormData();
    form.append("text", text);
    return request<AiMealDraft>("/ai/parse-meal", { method: "POST", body: form });
  },
```

- [ ] **Step 3: Type-check the frontend**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/types.ts src/api.ts
git commit -m "Add AiMealDraft type and api client methods for AI meal parsing"
```

---

### Task 4: Frontend — `MealSheet` accepts a prefill `draft`

**Files:**
- Modify: `frontend/src/components/MealSheet.tsx`

**Interfaces:**
- Consumes: `AiMealDraft` type from `frontend/src/types.ts` (Task 3).
- Produces: `MealSheet` gains an optional `draft?: Pick<AiMealDraft, "type" | "description" | "calories"> | null` prop, used only to seed initial state when `meal` is `null`. Consumed by Task 6.

- [ ] **Step 1: Update the type import**

In `frontend/src/components/MealSheet.tsx`, update the type import at the top:

```ts
import { MEAL_TYPES, type AiMealDraft, type Meal, type MealType } from "../types";
```

- [ ] **Step 2: Add the `draft` prop and seed initial state from it**

Replace the component signature and the first three `useState` lines:

```ts
export function MealSheet({
  meal,
  draft,
  onClose,
  onSaved,
}: {
  meal: Meal | null;
  draft?: Pick<AiMealDraft, "type" | "description" | "calories"> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<MealType>(meal?.type ?? draft?.type ?? defaultMealTypeForNow());
  const [description, setDescription] = useState(meal?.description ?? draft?.description ?? "");
  const [calories, setCalories] = useState(meal ? String(meal.calories) : draft ? String(draft.calories) : "");
```

Leave everything else in the file (photo state, `save()`, JSX) unchanged.

- [ ] **Step 3: Type-check the frontend**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/components/MealSheet.tsx
git commit -m "Let MealSheet seed its initial state from an AI-generated draft"
```

---

### Task 5: Frontend — `AiMealCapture` modal component

**Files:**
- Create: `frontend/src/components/AiMealCapture.tsx`
- Modify: `frontend/src/theme.css`

**Interfaces:**
- Consumes: `api.parseMealFromAudio`, `api.parseMealFromText` (Task 3), `AiMealDraft` type (Task 3).
- Produces: `export function AiMealCapture({ onClose, onDraft }: { onClose: () => void; onDraft: (draft: AiMealDraft) => void })` and `export function MicIcon({ size }: { size?: number })`. Consumed by Task 6.

- [ ] **Step 1: Add FAB styles to `theme.css`**

In `frontend/src/theme.css`, add after the `.theme-toggle:hover` rule:

```css
.ai-fab-wrap {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 430px;
  bottom: 150px;
  z-index: 15;
  pointer-events: none;
}
.ai-fab {
  position: absolute;
  right: 20px;
  bottom: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-surface);
  border: 2px solid var(--color-divider);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
}
.ai-fab:hover { border-color: var(--color-accent); color: var(--color-accent); }
```

And inside the existing `@media (min-width: 880px) { ... }` block (the one that already contains `.desktop-sidebar` and `.app-main` overrides), add:

```css
  .ai-fab-wrap { max-width: 720px; bottom: 30px; }
```

- [ ] **Step 2: Create `AiMealCapture.tsx`**

Create `frontend/src/components/AiMealCapture.tsx`:

```tsx
import { useRef, useState } from "react";
import { api } from "../api";
import type { AiMealDraft } from "../types";

type Status = "idle" | "recording" | "loading" | "error";

export function MicIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0014 0M12 18v4M8 22h8" />
    </svg>
  );
}

export function AiMealCapture({ onClose, onDraft }: { onClose: () => void; onDraft: (draft: AiMealDraft) => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);

  function stopTimers() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
    timerRef.current = null;
    autoStopRef.current = null;
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        void submitAudio(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
      autoStopRef.current = window.setTimeout(() => stopRecording(), 60000);
    } catch {
      setError("No se pudo acceder al micrófono. Revisá los permisos del navegador.");
      setStatus("error");
    }
  }

  function stopRecording() {
    stopTimers();
    mediaRecorderRef.current?.stop();
  }

  async function submitAudio(blob: Blob) {
    setStatus("loading");
    try {
      const draft = await api.parseMealFromAudio(blob);
      onDraft(draft);
    } catch {
      setError("No se pudo interpretar el audio. Probá de nuevo o cargalo manualmente.");
      setStatus("error");
    }
  }

  async function submitText() {
    if (!text.trim()) return;
    setStatus("loading");
    setError(null);
    try {
      const draft = await api.parseMealFromText(text.trim());
      onDraft(draft);
    } catch {
      setError("No se pudo interpretar el texto. Probá de nuevo o cargalo manualmente.");
      setStatus("error");
    }
  }

  const busy = status === "loading" || status === "recording";

  return (
    <div className="sheet-overlay">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "2px solid var(--color-divider)" }}>
        <h4>Contame qué comiste</h4>
        <button type="button" onClick={onClose} style={{ width: 44, height: 44, background: "transparent", border: 0, color: "var(--color-text)", cursor: "pointer" }}>
          ✕
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
        <button
          type="button"
          onClick={status === "recording" ? stopRecording : startRecording}
          disabled={status === "loading"}
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            border: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: status === "recording" ? "var(--color-accent)" : "var(--color-surface)",
            color: status === "recording" ? "var(--color-bg)" : "var(--color-text)",
            cursor: status === "loading" ? "default" : "pointer",
            boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
          }}
        >
          <MicIcon size={36} />
        </button>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-muted)", textAlign: "center" }}>
          {status === "recording" && `Grabando… ${recordSeconds}s (toca para terminar)`}
          {status === "loading" && "Analizando…"}
          {status === "idle" && "Toca para grabar"}
          {status === "error" && "Toca para reintentar"}
        </div>

        <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, color: "var(--color-muted)", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
          <div style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />
          o escribí
          <div style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Comí una milanesa con papas fritas y una coca"
          disabled={busy}
          style={{ width: "100%", padding: 12, fontSize: 16, background: "var(--color-surface)", color: "var(--color-text)", border: "2px solid var(--color-divider)", resize: "none" }}
        />
        <button
          type="button"
          onClick={submitText}
          disabled={busy || !text.trim()}
          style={{ width: "100%", minHeight: 52, background: "var(--color-accent)", color: "var(--color-bg)", border: 0, fontWeight: 800, fontSize: 16, cursor: busy ? "default" : "pointer", opacity: status === "loading" ? 0.7 : 1 }}
        >
          Interpretar texto
        </button>

        {error && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-accent)" }}>{error}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check the frontend**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/components/AiMealCapture.tsx src/theme.css
git commit -m "Add AiMealCapture modal for voice/text meal entry"
```

---

### Task 6: Frontend — wire the FAB and draft flow into `TodayScreen`

**Files:**
- Modify: `frontend/src/screens/TodayScreen.tsx`

**Interfaces:**
- Consumes: `AiMealCapture`, `MicIcon` (Task 5); `AiMealDraft` type (Task 3); `MealSheet`'s `draft` prop (Task 4).

- [ ] **Step 1: Update imports**

In `frontend/src/screens/TodayScreen.tsx`, add these imports alongside the existing ones:

```ts
import { AiMealCapture, MicIcon } from "../components/AiMealCapture";
import type { AiMealDraft } from "../types";
```

- [ ] **Step 2: Add state for the AI capture flow**

After the existing `const [editing, setEditing] = useState<Meal | null>(null);` line, add:

```ts
  const [aiCaptureOpen, setAiCaptureOpen] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiMealDraft | null>(null);
```

- [ ] **Step 3: Include the AI draft in meal-sheet visibility and close logic**

Replace:

```ts
  const mealSheetVisible = sheetOpen || editing !== null;
  function closeMealSheet() {
    setEditing(null);
    onCloseSheet();
  }
```

with:

```ts
  const mealSheetVisible = sheetOpen || editing !== null || aiDraft !== null;
  function closeMealSheet() {
    setEditing(null);
    setAiDraft(null);
    onCloseSheet();
  }
```

- [ ] **Step 4: Render the FAB and the AI capture modal, and pass `draft` to `MealSheet`**

Add the FAB markup right before the closing `</div>` that wraps the whole component's returned JSX top level (i.e., as a sibling of the existing `<section>` elements, so it stays fixed-positioned regardless of scroll):

```tsx
      <div className="ai-fab-wrap">
        <button type="button" className="ai-fab" onClick={() => setAiCaptureOpen(true)} aria-label="Cargar comida por voz">
          <MicIcon />
        </button>
      </div>

      {aiCaptureOpen && (
        <AiMealCapture
          onClose={() => setAiCaptureOpen(false)}
          onDraft={(draft) => {
            setAiCaptureOpen(false);
            setAiDraft(draft);
          }}
        />
      )}
```

Then update the existing `MealSheet` render to pass the draft through:

```tsx
      {mealSheetVisible && (
        <MealSheet
          meal={editing}
          draft={editing ? undefined : aiDraft}
          onClose={closeMealSheet}
          onSaved={() => {
            setEditing(null);
            setAiDraft(null);
            onCloseSheet();
            reload();
          }}
        />
      )}
```

- [ ] **Step 5: Type-check the frontend**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/screens/TodayScreen.tsx
git commit -m "Wire AI meal capture FAB into TodayScreen"
```

---

### Task 7: Manual verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Set `OPENAI_API_KEY` locally**

Add a real `OPENAI_API_KEY` value to `backend/.env` (not committed — it's already gitignored alongside the other secrets in that file).

- [ ] **Step 2: Start both dev servers**

Run: `cd backend && npm run dev` (leave running)
Run (new shell): `cd frontend && npm run dev` (leave running)

- [ ] **Step 3: Drive the free-text flow end-to-end via claude-in-chrome**

Navigate to the frontend dev URL, log in with the PIN, go to "Hoy", tap the new mic FAB, type a sentence like "Comí una milanesa con papas fritas y una coca" into the textarea, tap "Interpretar texto", and confirm `MealSheet` opens prefilled with a plausible type/description/calories. Save it and confirm it appears in the meal list.

- [ ] **Step 4: Spot-check the audio flow**

If the browser environment allows granting microphone permission, record a short sentence via the mic button and confirm the same prefill behavior. If mic permission can't be granted in the automated browser environment, note this explicitly and leave final audio verification to the user testing on their own device.

- [ ] **Step 5: Check error handling**

With the backend dev server running, stop it (Ctrl+C in its shell), then submit a text prompt in `AiMealCapture`. Confirm the frontend shows the Spanish error message ("No se pudo interpretar el texto...") and lets the user retry, rather than crashing the modal. Restart the backend afterward.

- [ ] **Step 6: Report findings**

Summarize what worked, what didn't, and any follow-up needed (e.g., calorie estimate quality, FAB placement on desktop vs mobile).
