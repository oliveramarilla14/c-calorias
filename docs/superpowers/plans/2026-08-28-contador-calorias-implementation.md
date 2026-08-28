# Contador de Calorías — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy PLATO, a single-user, PIN-protected calorie tracker with daily meal logging, a weekly summary, and a weekly weight log, matching the approved design mock.

**Architecture:** A single Git repo with two sibling projects — `backend/` (Node + Express + TypeScript + Prisma/PostgreSQL, REST API under `/api`) and `frontend/` (React + Vite + TypeScript, mobile-first single page app). In production the backend serves the built frontend as static files from the same process, so the whole app is one Railway service. Auth is a single shared 4-digit PIN (no user table): a correct PIN sets an `httpOnly` signed JWT cookie valid 30 days; every `/api/*` route except `/api/auth/login` requires it.

**Tech Stack:** TypeScript everywhere. Backend: Express 4, Prisma ORM, PostgreSQL, zod (validation), bcryptjs + jsonwebtoken (auth), express-rate-limit, multer + @aws-sdk/client-s3 (R2 photo upload), Vitest + Supertest (tests). Frontend: React 18, Vite, plain CSS (ported "Modernist" design tokens, no UI framework), fetch-based API client.

**Spec:** `docs/superpowers/specs/2026-08-28-contador-calorias-design.md`
**Visual design reference (Claude Design mock):** `PLATO.dc.html` from Claude Design project `ef3ff5de-f121-44e8-b1b2-653d9a92afb4` (fetched and inlined into this plan's frontend tasks — dark "Modernist" theme, accent `#ec3013`, Archivo font, 0 border-radius, 2px dividers, bottom tab nav with Hoy/Semana/Peso, full-screen sheet modals for the meal and weight forms).

## Global Constraints

- Objetivo calórico diario fijo: 2000 (configurable solo por env var `DAILY_CALORIE_GOAL`, no editable desde la UI en v1).
- Tipos de comida permitidos, en este orden fijo: `Desayuno`, `Almuerzo`, `Merienda`, `Cena`, `Snack`.
- Semana = lunes a domingo.
- PIN de acceso: 4 dígitos numéricos, hasheado (bcrypt) y guardado en env var `PIN_HASH`, nunca en la base de datos.
- Sesión: cookie `session`, `httpOnly`, `secure` en producción, `sameSite=lax`, JWT firmado, expira a los 30 días.
- Rate limit de `/api/auth/login`: 5 intentos fallidos por IP cada 15 minutos → 429.
- Toda ruta `/api/*` salvo `/api/auth/login` y `/api/auth/logout` exige sesión válida → 401 si falta o es inválida.
- Falla en subida de foto nunca bloquea el guardado de una comida.
- No hay tabla de usuarios ni multi-usuario en v1.
- No hay E2E automatizado en v1; los tests de frontend son best-effort, no bloqueantes.

---

## File Structure

```
c-calorias/
  backend/
    package.json
    tsconfig.json
    .env.example
    prisma/
      schema.prisma
    src/
      index.ts
      app.ts
      config.ts
      db.ts
      week.ts
      auth/
        auth.service.ts
        auth.middleware.ts
        auth.routes.ts
      meals/
        meals.service.ts
        meals.routes.ts
      weights/
        weights.service.ts
        weights.routes.ts
      summary/
        summary.service.ts
        summary.routes.ts
      uploads/
        r2.ts
        uploads.routes.ts
    test/
      week.test.ts
      auth.test.ts
      meals.test.ts
      weights.test.ts
      summary.test.ts
      uploads.test.ts
      helpers/testApp.ts
  frontend/
    package.json
    vite.config.ts
    tsconfig.json
    index.html
    src/
      main.tsx
      App.tsx
      api.ts
      types.ts
      theme.css
      screens/
        LoginScreen.tsx
        TodayScreen.tsx
        WeekScreen.tsx
        WeightScreen.tsx
      components/
        BottomNav.tsx
        MealListItem.tsx
        MealSheet.tsx
        WeightSheet.tsx
  package.json          (root — build/start scripts for Railway)
  Procfile / railway.json
```

---

### Task 1: Backend project scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env.example`
- Create: `backend/src/config.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/index.ts`
- Test: `backend/test/health.test.ts`

**Interfaces:**
- Produces: `config` object (`backend/src/config.ts`) with getters `port`, `databaseUrl`, `pinHash`, `sessionSecret`, `dailyCalorieGoal`, `r2AccountId`, `r2AccessKeyId`, `r2SecretAccessKey`, `r2Bucket`, `r2PublicUrl`. Each throws `Error("Missing required env var <NAME>")` if unset, read lazily (not at import time) so tests only need the env vars they touch.
- Produces: `createApp(): express.Express` (`backend/src/app.ts`) — builds and returns the Express app without calling `.listen()`, so tests can mount it with Supertest.

- [ ] **Step 1: Initialize backend package**

```bash
mkdir -p /home/oliver/projects/personal/c-calorias/backend/src
cd /home/oliver/projects/personal/c-calorias/backend
npm init -y
npm install express cookie-parser dotenv zod bcryptjs jsonwebtoken express-rate-limit multer @prisma/client @aws-sdk/client-s3
npm install -D typescript tsx vitest supertest @types/express @types/cookie-parser @types/node @types/bcryptjs @types/jsonwebtoken @types/supertest @types/multer prisma
```

- [ ] **Step 2: Write `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Set `backend/package.json` scripts and `"type": "module"`**

Edit `backend/package.json` so it contains:

```json
{
  "name": "c-calorias-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "prisma generate && tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

(keep the `dependencies`/`devDependencies` npm already wrote into this file)

- [ ] **Step 4: Write `backend/.env.example`**

```bash
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/c_calorias
PIN_HASH=
SESSION_SECRET=change-me
DAILY_CALORIE_GOAL=2000
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=c-calorias-photos
R2_PUBLIC_URL=
```

- [ ] **Step 5: Write `backend/src/config.ts`**

```ts
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const config = {
  get port() {
    return Number(process.env.PORT ?? 3001);
  },
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get pinHash() {
    return required("PIN_HASH");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get dailyCalorieGoal() {
    return Number(process.env.DAILY_CALORIE_GOAL ?? 2000);
  },
  get r2AccountId() {
    return required("R2_ACCOUNT_ID");
  },
  get r2AccessKeyId() {
    return required("R2_ACCESS_KEY_ID");
  },
  get r2SecretAccessKey() {
    return required("R2_SECRET_ACCESS_KEY");
  },
  get r2Bucket() {
    return required("R2_BUCKET");
  },
  get r2PublicUrl() {
    return required("R2_PUBLIC_URL");
  },
};
```

- [ ] **Step 6: Write `backend/src/app.ts`**

```ts
import express from "express";
import cookieParser from "cookie-parser";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
```

- [ ] **Step 7: Write `backend/src/index.ts`**

```ts
import "dotenv/config";
import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();
app.listen(config.port, () => {
  console.log(`c-calorias backend listening on :${config.port}`);
});
```

- [ ] **Step 8: Write the failing test `backend/test/health.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("GET /api/health", () => {
  it("returns ok:true", async () => {
    const app = createApp();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 9: Add `backend/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 10: Run the test suite**

Run: `cd /home/oliver/projects/personal/c-calorias/backend && npx vitest run`
Expected: 1 passed (`GET /api/health`)

- [ ] **Step 11: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add backend/
git commit -m "Scaffold backend: Express app, config loader, health check"
```

---

### Task 2: Database schema (Prisma + PostgreSQL) and local dev DB

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/db.ts`
- Create: `docker-compose.yml`

**Interfaces:**
- Produces: `prisma` (default export from `backend/src/db.ts`) — a shared `PrismaClient` singleton used by every service module.
- Produces: Prisma models `Meal` (`id, type, description, calories, photoUrl, consumedAt, createdAt, updatedAt`) and `Weight` (`id, weightKg, recordedAt, createdAt, updatedAt`), mapped to tables `meals` / `weights`.

- [ ] **Step 1: Write `docker-compose.yml`** (local Postgres for development/tests)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: c_calorias
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

- [ ] **Step 2: Start Postgres locally**

Run: `cd /home/oliver/projects/personal/c-calorias && docker compose up -d postgres`
Expected: container `c-calorias-postgres-1` running and healthy (`docker compose ps`)

- [ ] **Step 3: Write `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Meal {
  id          Int      @id @default(autoincrement())
  type        String
  description String
  calories    Int
  photoUrl    String?
  consumedAt  DateTime @db.Date
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("meals")
}

model Weight {
  id         Int      @id @default(autoincrement())
  weightKg   Decimal  @db.Decimal(5, 2)
  recordedAt DateTime @db.Date
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("weights")
}
```

- [ ] **Step 4: Copy `.env.example` to `.env` with real local values**

```bash
cd /home/oliver/projects/personal/c-calorias/backend
cp .env.example .env
```

Edit `.env`: set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/c_calorias`, `SESSION_SECRET` to any random string, and leave `PIN_HASH`/R2 vars for Task 4/8.

- [ ] **Step 5: Run the initial migration**

Run: `cd /home/oliver/projects/personal/c-calorias/backend && npx prisma migrate dev --name init`
Expected: creates `backend/prisma/migrations/<timestamp>_init/migration.sql` and applies it; Prisma Client is generated with no errors.

- [ ] **Step 6: Write `backend/src/db.ts`**

```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

- [ ] **Step 7: Verify the app still builds and the health test still passes**

Run: `cd /home/oliver/projects/personal/c-calorias/backend && npx vitest run`
Expected: 1 passed

- [ ] **Step 8: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add backend/prisma backend/src/db.ts docker-compose.yml
git commit -m "Add Postgres schema (meals, weights) via Prisma"
```

(`.env` must NOT be committed — confirm `backend/.gitignore` contains `.env`, `node_modules`, `dist`; create it first if missing with those three lines plus `dist/`.)

---

### Task 3: Week-boundary utility (Monday–Sunday)

**Files:**
- Create: `backend/src/week.ts`
- Test: `backend/test/week.test.ts`

**Interfaces:**
- Produces: `getWeekRange(date: Date): { start: Date; end: Date }` — `start` is the Monday 00:00 UTC of `date`'s week, `end` is that Sunday.
- Produces: `weeksAgoRange(date: Date, weeksAgo: number): { start: Date; end: Date }` — same as `getWeekRange` shifted back `weeksAgo` full weeks.
- Produces: `toISODate(d: Date): string` — `YYYY-MM-DD`.
- Produces: `daysElapsedInWeek(date: Date): number` — 1 (Monday) through 7 (Sunday), how many days of `date`'s week have occurred up to and including `date`.
- Consumed by: Tasks 5, 6, 7 (meals week filter, Friday-banner check, weekly summary).

- [ ] **Step 1: Write the failing test `backend/test/week.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { getWeekRange, weeksAgoRange, toISODate, daysElapsedInWeek } from "../src/week.js";

describe("getWeekRange", () => {
  it("returns Monday-Sunday for a Wednesday", () => {
    const { start, end } = getWeekRange(new Date("2026-08-26T12:00:00Z")); // Wed
    expect(toISODate(start)).toBe("2026-08-24"); // Mon
    expect(toISODate(end)).toBe("2026-08-30"); // Sun
  });

  it("returns the same week for the Sunday itself", () => {
    const { start, end } = getWeekRange(new Date("2026-08-30T23:00:00Z")); // Sun
    expect(toISODate(start)).toBe("2026-08-24");
    expect(toISODate(end)).toBe("2026-08-30");
  });

  it("returns the same week for the Monday itself", () => {
    const { start, end } = getWeekRange(new Date("2026-08-24T00:00:00Z")); // Mon
    expect(toISODate(start)).toBe("2026-08-24");
    expect(toISODate(end)).toBe("2026-08-30");
  });
});

describe("weeksAgoRange", () => {
  it("shifts back N full weeks", () => {
    const { start, end } = weeksAgoRange(new Date("2026-08-26T12:00:00Z"), 2);
    expect(toISODate(start)).toBe("2026-08-10");
    expect(toISODate(end)).toBe("2026-08-16");
  });
});

describe("daysElapsedInWeek", () => {
  it("is 1 for Monday", () => {
    expect(daysElapsedInWeek(new Date("2026-08-24T10:00:00Z"))).toBe(1);
  });
  it("is 3 for Wednesday", () => {
    expect(daysElapsedInWeek(new Date("2026-08-26T10:00:00Z"))).toBe(3);
  });
  it("is 7 for Sunday", () => {
    expect(daysElapsedInWeek(new Date("2026-08-30T10:00:00Z"))).toBe(7);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/oliver/projects/personal/c-calorias/backend && npx vitest run test/week.test.ts`
Expected: FAIL — `Cannot find module '../src/week.js'`

- [ ] **Step 3: Write `backend/src/week.ts`**

```ts
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() + diffToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}

export function weeksAgoRange(date: Date, weeksAgo: number): { start: Date; end: Date } {
  const { start, end } = getWeekRange(date);
  start.setUTCDate(start.getUTCDate() - 7 * weeksAgo);
  end.setUTCDate(end.getUTCDate() - 7 * weeksAgo);
  return { start, end };
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysElapsedInWeek(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/oliver/projects/personal/c-calorias/backend && npx vitest run test/week.test.ts`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add backend/src/week.ts backend/test/week.test.ts
git commit -m "Add Monday-Sunday week-boundary utility"
```

---

### Task 4: Auth — PIN login, session cookie, rate limiting, protection middleware

**Files:**
- Create: `backend/src/auth/auth.service.ts`
- Create: `backend/src/auth/auth.middleware.ts`
- Create: `backend/src/auth/auth.routes.ts`
- Modify: `backend/src/app.ts` — mount `authRouter` at `/api/auth`
- Test: `backend/test/auth.test.ts`

**Interfaces:**
- Produces: `verifyPin(pin: string): boolean`, `signSession(): string`, `verifySession(token: string): boolean` (`auth.service.ts`).
- Produces: `requireAuth` Express middleware (`auth.middleware.ts`) — 401 `{ error: "unauthorized" }` if `req.cookies.session` is missing/invalid, else calls `next()`.
- Produces: `authRouter` (`auth.routes.ts`) with `POST /login` (body `{ pin: string }`) and `POST /logout`.
- Consumed by: Tasks 5, 6, 7, 8 (`requireAuth` guards every other router).

- [ ] **Step 1: Write `backend/src/auth/auth.service.ts`**

```ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function verifyPin(pin: string): boolean {
  return bcrypt.compareSync(pin, config.pinHash);
}

export function signSession(): string {
  return jwt.sign({ auth: true }, config.sessionSecret, { expiresIn: "30d" });
}

export function verifySession(token: string): boolean {
  try {
    jwt.verify(token, config.sessionSecret);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Write `backend/src/auth/auth.middleware.ts`**

```ts
import type { Request, Response, NextFunction } from "express";
import { verifySession } from "./auth.service.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.session;
  if (!token || !verifySession(token)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}
```

- [ ] **Step 3: Write `backend/src/auth/auth.routes.ts`**

```ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { verifyPin, signSession } from "./auth.service.js";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_attempts" },
});

export const authRouter = Router();

authRouter.post("/login", loginLimiter, (req, res) => {
  const pin = String(req.body?.pin ?? "");
  if (!/^\d{4}$/.test(pin) || !verifyPin(pin)) {
    res.status(401).json({ error: "invalid_pin" });
    return;
  }
  const token = signSession();
  res.cookie("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.status(200).json({ ok: true });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("session");
  res.status(200).json({ ok: true });
});
```

- [ ] **Step 4: Mount the router in `backend/src/app.ts`**

```ts
import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./auth/auth.routes.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);

  return app;
}
```

- [ ] **Step 5: Write the failing test `backend/test/auth.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";

process.env.SESSION_SECRET = "test-secret";
process.env.PIN_HASH = bcrypt.hashSync("1234", 10);

const { createApp } = await import("../src/app.js");

describe("POST /api/auth/login", () => {
  it("rejects a wrong PIN with 401", async () => {
    const app = createApp();
    const res = await request(app).post("/api/auth/login").send({ pin: "0000" });
    expect(res.status).toBe(401);
  });

  it("accepts the correct PIN and sets a session cookie", async () => {
    const app = createApp();
    const res = await request(app).post("/api/auth/login").send({ pin: "1234" });
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^session=/);
  });

  it("rate-limits after 5 failed attempts", async () => {
    const app = createApp();
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/auth/login").send({ pin: "0000" });
    }
    const res = await request(app).post("/api/auth/login").send({ pin: "0000" });
    expect(res.status).toBe(429);
  });
});

describe("requireAuth", () => {
  it("blocks unauthenticated requests to a protected route with 401", async () => {
    const app = createApp();
    app.get("/api/_protected_probe", (await import("../src/auth/auth.middleware.js")).requireAuth, (_req: any, res: any) =>
      res.json({ ok: true })
    );
    const res = await request(app).get("/api/_protected_probe");
    expect(res.status).toBe(401);
  });

  it("allows requests carrying a valid session cookie", async () => {
    const app = createApp();
    app.get("/api/_protected_probe", (await import("../src/auth/auth.middleware.js")).requireAuth, (_req: any, res: any) =>
      res.json({ ok: true })
    );
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ pin: "1234" });
    const res = await agent.get("/api/_protected_probe");
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd /home/oliver/projects/personal/c-calorias/backend && npx vitest run test/auth.test.ts`
Expected: FAIL (module not found until Steps 1–4 exist; run this after Step 1–4 are already written the test should mostly pass — if executing strictly TDD-first, skip straight to Step 7 since the service/middleware/routes above were written before the test in this plan for readability)

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd /home/oliver/projects/personal/c-calorias/backend && npx vitest run test/auth.test.ts`
Expected: 5 passed

- [ ] **Step 8: Generate a real local PIN hash and put it in `.env`**

```bash
cd /home/oliver/projects/personal/c-calorias/backend
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 1234
```

Copy the printed hash into `backend/.env` as `PIN_HASH=...` (use your own real 4-digit PIN here, not `1234`, for anything beyond local testing).

- [ ] **Step 9: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add backend/src/auth backend/src/app.ts backend/test/auth.test.ts
git commit -m "Add PIN auth: login/logout, session cookie, rate limiting, requireAuth"
```

---

### Task 5: Meals CRUD

**Files:**
- Create: `backend/src/meals/meals.service.ts`
- Create: `backend/src/meals/meals.routes.ts`
- Modify: `backend/src/app.ts` — mount `mealsRouter` at `/api/meals`, guarded by `requireAuth`
- Test: `backend/test/meals.test.ts`
- Create: `backend/test/helpers/testApp.ts`

**Interfaces:**
- Produces: `MEAL_TYPES = ["Desayuno", "Almuerzo", "Merienda", "Cena", "Snack"] as const` and `MealType` (`meals.service.ts`) — reused by Task 7.
- Produces: `listMealsByDate(date: string)`, `listMealsByWeek(start: Date, end: Date)`, `createMeal(input)`, `updateMeal(id, input)`, `deleteMeal(id)` — all return/await Prisma `Meal` records.
- Produces: `mealsRouter` — `GET /` (`?date=YYYY-MM-DD` default today, or `?week=YYYY-MM-DD`), `POST /`, `PUT /:id`, `DELETE /:id`.
- Consumes: `getWeekRange`, `toISODate` from `../week.js` (Task 3); `requireAuth` from `../auth/auth.middleware.js` (Task 4); `prisma` from `../db.js` (Task 2).

- [ ] **Step 1: Write the shared test helper `backend/test/helpers/testApp.ts`**

```ts
import bcrypt from "bcryptjs";
import request from "supertest";

process.env.SESSION_SECRET ??= "test-secret";
process.env.PIN_HASH ??= bcrypt.hashSync("1234", 10);

export async function authedAgent() {
  const { createApp } = await import("../../src/app.js");
  const app = createApp();
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ pin: "1234" });
  return { app, agent };
}
```

- [ ] **Step 2: Write `backend/src/meals/meals.service.ts`**

```ts
import { prisma } from "../db.js";

export const MEAL_TYPES = ["Desayuno", "Almuerzo", "Merienda", "Cena", "Snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export interface MealInput {
  type: MealType;
  description: string;
  calories: number;
  photoUrl?: string | null;
  consumedAt: string; // YYYY-MM-DD
}

export function listMealsByDate(date: string) {
  return prisma.meal.findMany({
    where: { consumedAt: new Date(date) },
    orderBy: { id: "asc" },
  });
}

export function listMealsByWeek(start: Date, end: Date) {
  return prisma.meal.findMany({
    where: { consumedAt: { gte: start, lte: end } },
    orderBy: { consumedAt: "asc" },
  });
}

export function createMeal(input: MealInput) {
  return prisma.meal.create({
    data: {
      type: input.type,
      description: input.description,
      calories: input.calories,
      photoUrl: input.photoUrl ?? null,
      consumedAt: new Date(input.consumedAt),
    },
  });
}

export function updateMeal(id: number, input: MealInput) {
  return prisma.meal.update({
    where: { id },
    data: {
      type: input.type,
      description: input.description,
      calories: input.calories,
      photoUrl: input.photoUrl ?? null,
      consumedAt: new Date(input.consumedAt),
    },
  });
}

export function deleteMeal(id: number) {
  return prisma.meal.delete({ where: { id } });
}
```

- [ ] **Step 3: Write `backend/src/meals/meals.routes.ts`**

```ts
import { Router } from "express";
import { z } from "zod";
import { getWeekRange, toISODate } from "../week.js";
import {
  MEAL_TYPES,
  listMealsByDate,
  listMealsByWeek,
  createMeal,
  updateMeal,
  deleteMeal,
} from "./meals.service.js";

const mealBodySchema = z.object({
  type: z.enum(MEAL_TYPES),
  description: z.string().trim().min(1),
  calories: z.number().int().positive(),
  photoUrl: z.string().url().nullable().optional(),
  consumedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const mealsRouter = Router();

mealsRouter.get("/", async (req, res) => {
  if (typeof req.query.week === "string") {
    const { start, end } = getWeekRange(new Date(req.query.week));
    const meals = await listMealsByWeek(start, end);
    res.json(meals);
    return;
  }
  const date = typeof req.query.date === "string" ? req.query.date : toISODate(new Date());
  const meals = await listMealsByDate(date);
  res.json(meals);
});

mealsRouter.post("/", async (req, res) => {
  const parsed = mealBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  const meal = await createMeal(parsed.data);
  res.status(201).json(meal);
});

mealsRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = mealBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  const meal = await updateMeal(id, parsed.data);
  res.json(meal);
});

mealsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await deleteMeal(id);
  res.status(204).send();
});
```

- [ ] **Step 4: Mount the router in `backend/src/app.ts`**

```ts
import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./auth/auth.routes.js";
import { requireAuth } from "./auth/auth.middleware.js";
import { mealsRouter } from "./meals/meals.routes.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/meals", requireAuth, mealsRouter);

  return app;
}
```

- [ ] **Step 5: Write the failing test `backend/test/meals.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/db.js";
import { authedAgent } from "./helpers/testApp.js";

beforeEach(async () => {
  await prisma.meal.deleteMany();
});

describe("Meals CRUD", () => {
  it("requires auth", async () => {
    const { app } = await authedAgent();
    const request = (await import("supertest")).default;
    const res = await request(app).get("/api/meals");
    expect(res.status).toBe(401);
  });

  it("creates, lists by date, updates and deletes a meal", async () => {
    const { agent } = await authedAgent();

    const create = await agent.post("/api/meals").send({
      type: "Almuerzo",
      description: "Pollo grillé con ensalada",
      calories: 450,
      consumedAt: "2026-08-28",
    });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const listByDate = await agent.get("/api/meals?date=2026-08-28");
    expect(listByDate.status).toBe(200);
    expect(listByDate.body).toHaveLength(1);
    expect(listByDate.body[0].description).toBe("Pollo grillé con ensalada");

    const update = await agent.put(`/api/meals/${id}`).send({
      type: "Cena",
      description: "Pollo grillé con ensalada y papas",
      calories: 600,
      consumedAt: "2026-08-28",
    });
    expect(update.status).toBe(200);
    expect(update.body.calories).toBe(600);

    const del = await agent.delete(`/api/meals/${id}`);
    expect(del.status).toBe(204);

    const listAfterDelete = await agent.get("/api/meals?date=2026-08-28");
    expect(listAfterDelete.body).toHaveLength(0);
  });

  it("rejects invalid calories with 400", async () => {
    const { agent } = await authedAgent();
    const res = await agent.post("/api/meals").send({
      type: "Almuerzo",
      description: "Test",
      calories: -5,
      consumedAt: "2026-08-28",
    });
    expect(res.status).toBe(400);
  });

  it("lists meals within a week range via ?week=", async () => {
    const { agent } = await authedAgent();
    await agent.post("/api/meals").send({
      type: "Desayuno",
      description: "Lunes",
      calories: 300,
      consumedAt: "2026-08-24",
    });
    await agent.post("/api/meals").send({
      type: "Desayuno",
      description: "Fuera de semana",
      calories: 300,
      consumedAt: "2026-08-17",
    });
    const res = await agent.get("/api/meals?week=2026-08-26");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].description).toBe("Lunes");
  });
});
```

- [ ] **Step 6: Run the test to verify it fails, then passes**

Run: `cd /home/oliver/projects/personal/c-calorias/backend && npx vitest run test/meals.test.ts`
Expected first (before Steps 2–4): FAIL — module not found. After Steps 2–4: 4 passed. Requires the local Postgres from Task 2 running (`docker compose up -d postgres`) and `npx prisma migrate dev` already applied.

- [ ] **Step 7: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add backend/src/meals backend/src/app.ts backend/test/meals.test.ts backend/test/helpers
git commit -m "Add meals CRUD API"
```

---

### Task 6: Weights CRUD

**Files:**
- Create: `backend/src/weights/weights.service.ts`
- Create: `backend/src/weights/weights.routes.ts`
- Modify: `backend/src/app.ts` — mount `weightsRouter` at `/api/weights`, guarded by `requireAuth`
- Test: `backend/test/weights.test.ts`

**Interfaces:**
- Produces: `listWeights()`, `createWeight(input)`, `updateWeight(id, input)`, `deleteWeight(id)` (`weights.service.ts`), where `input: { weightKg: number; recordedAt: string }`.
- Produces: `weightsRouter` — `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`.
- Consumed by: Task 7 (weekly-weight-logged check for the Friday banner uses `listWeights` results filtered by week range).

- [ ] **Step 1: Write `backend/src/weights/weights.service.ts`**

```ts
import { prisma } from "../db.js";

export interface WeightInput {
  weightKg: number;
  recordedAt: string; // YYYY-MM-DD
}

export function listWeights() {
  return prisma.weight.findMany({ orderBy: { recordedAt: "asc" } });
}

export function createWeight(input: WeightInput) {
  return prisma.weight.create({
    data: { weightKg: input.weightKg, recordedAt: new Date(input.recordedAt) },
  });
}

export function updateWeight(id: number, input: WeightInput) {
  return prisma.weight.update({
    where: { id },
    data: { weightKg: input.weightKg, recordedAt: new Date(input.recordedAt) },
  });
}

export function deleteWeight(id: number) {
  return prisma.weight.delete({ where: { id } });
}
```

- [ ] **Step 2: Write `backend/src/weights/weights.routes.ts`**

```ts
import { Router } from "express";
import { z } from "zod";
import { listWeights, createWeight, updateWeight, deleteWeight } from "./weights.service.js";

const weightBodySchema = z.object({
  weightKg: z.number().positive(),
  recordedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const weightsRouter = Router();

weightsRouter.get("/", async (_req, res) => {
  const weights = await listWeights();
  res.json(weights);
});

weightsRouter.post("/", async (req, res) => {
  const parsed = weightBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  const weight = await createWeight(parsed.data);
  res.status(201).json(weight);
});

weightsRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = weightBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  const weight = await updateWeight(id, parsed.data);
  res.json(weight);
});

weightsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await deleteWeight(id);
  res.status(204).send();
});
```

- [ ] **Step 3: Mount the router in `backend/src/app.ts`**

```ts
import { weightsRouter } from "./weights/weights.routes.js";
// ...
app.use("/api/weights", requireAuth, weightsRouter);
```

- [ ] **Step 4: Write the failing test `backend/test/weights.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/db.js";
import { authedAgent } from "./helpers/testApp.js";

beforeEach(async () => {
  await prisma.weight.deleteMany();
});

describe("Weights CRUD", () => {
  it("creates, lists, updates and deletes a weight entry", async () => {
    const { agent } = await authedAgent();

    const create = await agent.post("/api/weights").send({ weightKg: 83.4, recordedAt: "2026-08-21" });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const list = await agent.get("/api/weights");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const update = await agent.put(`/api/weights/${id}`).send({ weightKg: 83.1, recordedAt: "2026-08-21" });
    expect(update.status).toBe(200);
    expect(Number(update.body.weightKg)).toBe(83.1);

    const del = await agent.delete(`/api/weights/${id}`);
    expect(del.status).toBe(204);

    const listAfter = await agent.get("/api/weights");
    expect(listAfter.body).toHaveLength(0);
  });

  it("rejects a non-positive weight with 400", async () => {
    const { agent } = await authedAgent();
    const res = await agent.post("/api/weights").send({ weightKg: 0, recordedAt: "2026-08-21" });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /home/oliver/projects/personal/c-calorias/backend && npx vitest run test/weights.test.ts`
Expected: 2 passed

- [ ] **Step 6: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add backend/src/weights backend/src/app.ts backend/test/weights.test.ts
git commit -m "Add weights CRUD API"
```

---

### Task 7: Weekly summary aggregation

**Files:**
- Create: `backend/src/summary/summary.service.ts`
- Create: `backend/src/summary/summary.routes.ts`
- Modify: `backend/src/app.ts` — mount `summaryRouter` at `/api/summary`, guarded by `requireAuth`
- Test: `backend/test/summary.test.ts`

**Interfaces:**
- Produces: `getWeeklySummary(weeksCount: number, now?: Date)` (`summary.service.ts`) returning:
  ```ts
  {
    weekStart: string; weekEnd: string;       // YYYY-MM-DD
    weekTotal: number; weekAvg: number;        // weekAvg = round(weekTotal / daysElapsedInWeek(now))
    weeks: { weekStart: string; total: number }[]; // oldest -> newest, length = weeksCount, includes current week
    byType: { type: MealType; avg: number; count: number }[]; // avg = round(totalForType / count), 0 if count is 0, one row per MEAL_TYPES in fixed order
    hasWeighedThisWeek: boolean;
  }
  ```
- Produces: `GET /api/summary/weekly?weeks=N` (default `N=8`, clamped to `[1,12]`).
- Consumes: `MEAL_TYPES` from `../meals/meals.service.js` (Task 5); `listWeights` from `../weights/weights.service.js` (Task 6); `getWeekRange`, `weeksAgoRange`, `toISODate`, `daysElapsedInWeek` from `../week.js` (Task 3); `prisma` from `../db.js`.

- [ ] **Step 1: Write `backend/src/summary/summary.service.ts`**

```ts
import { prisma } from "../db.js";
import { getWeekRange, weeksAgoRange, toISODate, daysElapsedInWeek } from "../week.js";
import { MEAL_TYPES } from "../meals/meals.service.js";

export async function getWeeklySummary(weeksCount: number, now: Date = new Date()) {
  const clamped = Math.max(1, Math.min(12, weeksCount));
  const currentWeek = getWeekRange(now);

  const weeks: { weekStart: string; total: number }[] = [];
  for (let i = clamped - 1; i >= 0; i--) {
    const { start, end } = weeksAgoRange(now, i);
    const agg = await prisma.meal.aggregate({
      _sum: { calories: true },
      where: { consumedAt: { gte: start, lte: end } },
    });
    weeks.push({ weekStart: toISODate(start), total: agg._sum.calories ?? 0 });
  }
  const weekTotal = weeks[weeks.length - 1].total;
  const weekAvg = Math.round(weekTotal / daysElapsedInWeek(now));

  const byTypeRaw = await prisma.meal.groupBy({
    by: ["type"],
    where: { consumedAt: { gte: currentWeek.start, lte: currentWeek.end } },
    _sum: { calories: true },
    _count: { _all: true },
  });
  const byTypeMap = new Map(byTypeRaw.map((r) => [r.type, r]));
  const byType = MEAL_TYPES.map((type) => {
    const row = byTypeMap.get(type);
    const count = row?._count._all ?? 0;
    const total = row?._sum.calories ?? 0;
    return { type, count, avg: count > 0 ? Math.round(total / count) : 0 };
  });

  const weightThisWeek = await prisma.weight.findFirst({
    where: { recordedAt: { gte: currentWeek.start, lte: currentWeek.end } },
  });

  return {
    weekStart: toISODate(currentWeek.start),
    weekEnd: toISODate(currentWeek.end),
    weekTotal,
    weekAvg,
    weeks,
    byType,
    hasWeighedThisWeek: weightThisWeek !== null,
  };
}
```

- [ ] **Step 2: Write `backend/src/summary/summary.routes.ts`**

```ts
import { Router } from "express";
import { getWeeklySummary } from "./summary.service.js";

export const summaryRouter = Router();

summaryRouter.get("/weekly", async (req, res) => {
  const weeks = Number(req.query.weeks ?? 8);
  const summary = await getWeeklySummary(Number.isFinite(weeks) ? weeks : 8);
  res.json(summary);
});
```

- [ ] **Step 3: Mount the router in `backend/src/app.ts`**

```ts
import { summaryRouter } from "./summary/summary.routes.js";
// ...
app.use("/api/summary", requireAuth, summaryRouter);
```

- [ ] **Step 4: Write the failing test `backend/test/summary.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/db.js";
import { authedAgent } from "./helpers/testApp.js";

beforeEach(async () => {
  await prisma.meal.deleteMany();
  await prisma.weight.deleteMany();
});

describe("GET /api/summary/weekly", () => {
  it("aggregates current-week totals, per-type averages and weigh-in status", async () => {
    const { agent } = await authedAgent();

    // Monday and Wednesday of the week containing 2026-08-26 (Wed)
    await agent.post("/api/meals").send({ type: "Desayuno", description: "a", calories: 400, consumedAt: "2026-08-24" });
    await agent.post("/api/meals").send({ type: "Desayuno", description: "b", calories: 300, consumedAt: "2026-08-26" });
    await agent.post("/api/meals").send({ type: "Almuerzo", description: "c", calories: 700, consumedAt: "2026-08-26" });
    // outside this week
    await agent.post("/api/meals").send({ type: "Desayuno", description: "d", calories: 999, consumedAt: "2026-08-10" });

    const res = await agent.get("/api/summary/weekly?weeks=3");
    expect(res.status).toBe(200);
    expect(res.body.weekTotal).toBe(1400);
    expect(res.body.weeks).toHaveLength(3);
    expect(res.body.weeks[res.body.weeks.length - 1].total).toBe(1400);

    const desayuno = res.body.byType.find((t: any) => t.type === "Desayuno");
    expect(desayuno.avg).toBe(350); // (400+300)/2
    expect(desayuno.count).toBe(2);

    const cena = res.body.byType.find((t: any) => t.type === "Cena");
    expect(cena.avg).toBe(0);
    expect(cena.count).toBe(0);

    expect(res.body.hasWeighedThisWeek).toBe(false);

    await agent.post("/api/weights").send({ weightKg: 80, recordedAt: "2026-08-26" });
    const res2 = await agent.get("/api/summary/weekly");
    expect(res2.body.hasWeighedThisWeek).toBe(true);
  });
});
```

Note: this test asserts fixed values regardless of "today" — pass `now` explicitly if flakiness appears; since `weeksCount` window always includes the week containing the fixed dates above only when run in real time near that week, instead directly unit-test `getWeeklySummary` with an explicit `now` argument as the primary check:

- [ ] **Step 5: Add a `now`-pinned unit test in the same file** (append to `backend/test/summary.test.ts`)

```ts
import { getWeeklySummary } from "../src/summary/summary.service.js";

describe("getWeeklySummary (pinned date)", () => {
  it("computes totals for the week containing the given date", async () => {
    const { agent } = await authedAgent();
    await agent.post("/api/meals").send({ type: "Desayuno", description: "a", calories: 400, consumedAt: "2026-08-24" });
    await agent.post("/api/meals").send({ type: "Almuerzo", description: "b", calories: 700, consumedAt: "2026-08-26" });

    const summary = await getWeeklySummary(3, new Date("2026-08-26T12:00:00Z"));
    expect(summary.weekStart).toBe("2026-08-24");
    expect(summary.weekTotal).toBe(1100);
    expect(summary.weekAvg).toBe(Math.round(1100 / 3)); // Wednesday = day 3 of its week
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `cd /home/oliver/projects/personal/c-calorias/backend && npx vitest run test/summary.test.ts`
Expected: all passed

- [ ] **Step 7: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add backend/src/summary backend/src/app.ts backend/test/summary.test.ts
git commit -m "Add weekly summary aggregation API"
```

---

### Task 8: Photo upload to Cloudflare R2

**Files:**
- Create: `backend/src/uploads/r2.ts`
- Create: `backend/src/uploads/uploads.routes.ts`
- Modify: `backend/src/app.ts` — mount `uploadsRouter` at `/api/uploads`, guarded by `requireAuth`
- Test: `backend/test/uploads.test.ts`

**Interfaces:**
- Produces: `uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<string>` (`r2.ts`) — uploads and returns the public URL (`${config.r2PublicUrl}/${key}`).
- Produces: `uploadsRouter` — `POST /` accepting multipart field `photo`, returns `{ photo_url: string }` on success, `400` if no file or wrong mimetype, `502` if the R2 upload itself throws.

- [ ] **Step 1: Write `backend/src/uploads/r2.ts`**

```ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config.js";

function client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  });
}

export async function uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<string> {
  await client().send(
    new PutObjectCommand({
      Bucket: config.r2Bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return `${config.r2PublicUrl}/${key}`;
}
```

- [ ] **Step 2: Write `backend/src/uploads/uploads.routes.ts`**

```ts
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
```

- [ ] **Step 3: Mount the router in `backend/src/app.ts`**

```ts
import { uploadsRouter } from "./uploads/uploads.routes.js";
// ...
app.use("/api/uploads", requireAuth, uploadsRouter);
```

- [ ] **Step 4: Write the failing test `backend/test/uploads.test.ts`** (mocks the R2 client so no network/credentials are needed)

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../src/uploads/r2.js", () => ({
  uploadToR2: vi.fn(async (_buf: Buffer, key: string) => `https://photos.example.com/${key}`),
}));

const { authedAgent } = await import("./helpers/testApp.js");

describe("POST /api/uploads", () => {
  it("uploads an image and returns its public URL", async () => {
    const { agent } = await authedAgent();
    const res = await agent
      .post("/api/uploads")
      .attach("photo", Buffer.from("fake-image-bytes"), { filename: "plate.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(201);
    expect(res.body.photo_url).toMatch(/^https:\/\/photos\.example\.com\/meals\//);
  });

  it("rejects a non-image file with 400", async () => {
    const { agent } = await authedAgent();
    const res = await agent
      .post("/api/uploads")
      .attach("photo", Buffer.from("not an image"), { filename: "notes.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });

  it("rejects a request with no file with 400", async () => {
    const { agent } = await authedAgent();
    const res = await agent.post("/api/uploads");
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /home/oliver/projects/personal/c-calorias/backend && npx vitest run test/uploads.test.ts`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add backend/src/uploads backend/src/app.ts backend/test/uploads.test.ts
git commit -m "Add photo upload to Cloudflare R2"
```

---

### Task 9: Frontend scaffold, design tokens, and API client

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/theme.css`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api.ts`
- Test: `frontend/src/api.test.ts`

**Interfaces:**
- Produces: CSS custom properties in `theme.css` ported from the Modernist design system + PLATO's dark override (`--color-bg: #201e1d`, `--color-text: #f3f2f2`, `--color-accent: #ec3013`, plus the neutral/divider scale), used by every screen/component task.
- Produces: types `Meal`, `Weight`, `WeeklySummary`, `MealType` (`types.ts`), matching the backend's JSON shapes from Tasks 5–7.
- Produces: `api` object (`api.ts`) with `login(pin)`, `logout()`, `getMeals(params)`, `createMeal(input)`, `updateMeal(id, input)`, `deleteMeal(id)`, `getWeights()`, `createWeight(input)`, `updateWeight(id, input)`, `deleteWeight(id)`, `getWeeklySummary(weeks)`, `uploadPhoto(file)`. Every call uses `credentials: "include"`; any `401` response throws `AuthError` so callers can redirect to login.
- Consumed by: Tasks 10–13 (all screens).

- [ ] **Step 1: Scaffold the Vite project**

```bash
cd /home/oliver/projects/personal/c-calorias
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Remove Vite's default boilerplate**

```bash
cd /home/oliver/projects/personal/c-calorias/frontend
rm -f src/App.css src/index.css src/assets/react.svg
rm -rf src/assets
```

- [ ] **Step 3: Write `frontend/vite.config.ts`** (dev proxy to the backend, test config)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

- [ ] **Step 4: Write `frontend/src/theme.css`** (ported from the Modernist tokens + PLATO's dark override read from `PLATO.dc.html` and `_ds/.../styles.css`)

```css
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;800&display=swap');

:root {
  --color-bg: #201e1d;
  --color-surface: #2d2b2b;
  --color-text: #f3f2f2;
  --color-accent: #ec3013;
  --color-accent-600: #dd2b0f;
  --color-accent-700: #ff9783;
  --color-divider: color-mix(in srgb, #f3f2f2 25%, transparent);
  --color-neutral-300: #3a3737;
  --color-neutral-800: #605d5d;
  --color-muted: #7d7979;

  --font-heading: "Archivo", system-ui, sans-serif;
}

* { box-sizing: border-box; }
html, body, #root { margin: 0; height: 100%; }
body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-heading);
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3, h4, h5, h6 { font-weight: 800; margin: 0; letter-spacing: -0.02em; }
h6 { font-size: 12px; letter-spacing: 0.09em; text-transform: uppercase; }
a { color: var(--color-accent); }
a:hover { color: var(--color-accent-600); }
button { font-family: inherit; }
input, select, button, textarea { font-family: "Archivo", system-ui, sans-serif; }
input[type="number"].np::-webkit-outer-spin-button,
input[type="number"].np::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

@keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
```

- [ ] **Step 5: Write `frontend/src/types.ts`**

```ts
export const MEAL_TYPES = ["Desayuno", "Almuerzo", "Merienda", "Cena", "Snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export interface Meal {
  id: number;
  type: MealType;
  description: string;
  calories: number;
  photoUrl: string | null;
  consumedAt: string;
}

export interface Weight {
  id: number;
  weightKg: string; // Prisma Decimal serializes as string
  recordedAt: string;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  weekTotal: number;
  weekAvg: number;
  weeks: { weekStart: string; total: number }[];
  byType: { type: MealType; avg: number; count: number }[];
  hasWeighedThisWeek: boolean;
}
```

- [ ] **Step 6: Write `frontend/src/api.ts`**

```ts
import type { Meal, MealType, Weight, WeeklySummary } from "./types";

export class AuthError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...init,
  });
  if (res.status === 401) throw new AuthError("unauthorized");
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface MealInput {
  type: MealType;
  description: string;
  calories: number;
  photoUrl?: string | null;
  consumedAt: string;
}

export interface WeightInput {
  weightKg: number;
  recordedAt: string;
}

export const api = {
  login: (pin: string) => request<{ ok: true }>("/auth/login", { method: "POST", body: JSON.stringify({ pin }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  getMealsByDate: (date: string) => request<Meal[]>(`/meals?date=${date}`),
  getMealsByWeek: (weekDate: string) => request<Meal[]>(`/meals?week=${weekDate}`),
  createMeal: (input: MealInput) => request<Meal>("/meals", { method: "POST", body: JSON.stringify(input) }),
  updateMeal: (id: number, input: MealInput) =>
    request<Meal>(`/meals/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteMeal: (id: number) => request<void>(`/meals/${id}`, { method: "DELETE" }),

  getWeights: () => request<Weight[]>("/weights"),
  createWeight: (input: WeightInput) => request<Weight>("/weights", { method: "POST", body: JSON.stringify(input) }),
  updateWeight: (id: number, input: WeightInput) =>
    request<Weight>(`/weights/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteWeight: (id: number) => request<void>(`/weights/${id}`, { method: "DELETE" }),

  getWeeklySummary: (weeks: number) => request<WeeklySummary>(`/summary/weekly?weeks=${weeks}`),

  uploadPhoto: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("photo", file);
    const { photo_url } = await request<{ photo_url: string }>("/uploads", { method: "POST", body: form });
    return photo_url;
  },
};
```

- [ ] **Step 7: Write the failing test `frontend/src/api.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, AuthError } from "./api";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("api client", () => {
  it("sends credentials and JSON content-type on POST", async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await api.login("1234");
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(init.credentials).toBe("include");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ pin: "1234" });
  });

  it("throws AuthError on 401", async () => {
    (fetch as any).mockResolvedValue(new Response(null, { status: 401 }));
    await expect(api.getWeights()).rejects.toBeInstanceOf(AuthError);
  });
});
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd /home/oliver/projects/personal/c-calorias/frontend && npx vitest run src/api.test.ts`
Expected: 2 passed

- [ ] **Step 9: Wire `theme.css` into the app entry point — write `frontend/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 10: Simplify `frontend/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PLATO</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 11: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add frontend/
git commit -m "Scaffold frontend: Vite+React+TS, Modernist dark theme tokens, API client"
```

---

### Task 10: Login screen and auth flow

**Files:**
- Create: `frontend/src/screens/LoginScreen.tsx`
- Modify: `frontend/src/App.tsx` — session state, renders `LoginScreen` when logged out

**Interfaces:**
- Produces: `<LoginScreen onSuccess={() => void}>` — 4-digit PIN input (auto-submits on the 4th digit), calls `api.login`, shows an inline error on `401`/`429`.
- Consumes: `api.login` from Task 9.
- Produces (in `App.tsx`): top-level `loggedIn` boolean state. Since there is no `/api/auth/me` endpoint, session validity is discovered lazily — `App` starts by assuming logged-out and shows `LoginScreen`; any subsequent `AuthError` from any screen's data call flips it back to logged-out (wired fully in Task 14, stubbed here as a `handleAuthError` callback passed down).

- [ ] **Step 1: Write `frontend/src/screens/LoginScreen.tsx`**

```tsx
import { useState } from "react";
import { api } from "../api";

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(value: string) {
    setLoading(true);
    setError(null);
    try {
      await api.login(value);
      onSuccess();
    } catch (err) {
      if (err instanceof Error && err.message.includes("429")) {
        setError("Demasiados intentos. Esperá unos minutos.");
      } else {
        setError("PIN incorrecto.");
      }
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(next: string) {
    const digits = next.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
    if (digits.length === 4) submit(digits);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 18, height: 18, background: "var(--color-accent)" }} />
        <span style={{ fontWeight: 800, fontSize: 22 }}>PLATO</span>
      </div>
      <input
        autoFocus
        inputMode="numeric"
        type="password"
        value={pin}
        disabled={loading}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          width: 180,
          minHeight: 64,
          textAlign: "center",
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: "0.4em",
          background: "var(--color-surface)",
          color: "var(--color-text)",
          border: "2px solid var(--color-divider)",
          borderRadius: 0,
        }}
        placeholder="····"
      />
      {error && <span style={{ color: "var(--color-accent)", fontWeight: 600, fontSize: 13 }}>{error}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Write a minimal `frontend/src/App.tsx`** (full nav/screens wired in Task 14 — this step only makes the login flow renderable and testable end-to-end via `run`)

```tsx
import { useState } from "react";
import { LoginScreen } from "./screens/LoginScreen";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  if (!loggedIn) {
    return <LoginScreen onSuccess={() => setLoggedIn(true)} />;
  }

  return <div style={{ padding: 20 }}>Sesión iniciada.</div>;
}
```

- [ ] **Step 3: Manually verify the login flow**

Run the `run` skill (or `npm --prefix backend run dev` and `npm --prefix frontend run dev` in two terminals) and open the frontend URL. Confirm: typing 4 digits with the correct PIN shows "Sesión iniciada."; a wrong PIN shows "PIN incorrecto." and clears the input.

- [ ] **Step 4: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add frontend/src/screens/LoginScreen.tsx frontend/src/App.tsx
git commit -m "Add PIN login screen"
```

---

### Task 11: Today screen + meal registration/edit sheet

**Files:**
- Create: `frontend/src/components/MealListItem.tsx`
- Create: `frontend/src/components/MealSheet.tsx`
- Create: `frontend/src/screens/TodayScreen.tsx`
- Modify: `frontend/src/App.tsx` — render `TodayScreen` when logged in (temporary; Task 14 adds the other two screens + nav)

**Interfaces:**
- Produces: `<MealSheet meal={Meal | null} onClose={() => void} onSaved={() => void}>` — full-screen form (type/select, description/textarea, calories/number, optional photo). On save: if a photo file was picked, calls `api.uploadPhoto` first; if that throws, proceeds without a `photoUrl` (never blocks the save) and shows a small inline warning; then calls `api.createMeal`/`api.updateMeal` depending on whether `meal` is set.
- Produces: `<MealListItem meal={Meal} onEdit={() => void} onDelete={() => void}>`.
- Produces: `<TodayScreen dailyGoal={number} onOpenWeight={() => void}>` — fetches today's meals via `api.getMealsByDate`, shows consumed/goal/remaining + progress bar, the meal list, and (via a prop `showWeightBanner: boolean` passed down from `App` once wired in Task 14) the Friday weight banner.

- [ ] **Step 1: Write `frontend/src/components/MealListItem.tsx`**

```tsx
import type { Meal } from "../types";

export function MealListItem({ meal, onEdit, onDelete }: { meal: Meal; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 20px", borderTop: "1px solid var(--color-neutral-300)" }}>
      <div
        style={{
          width: 52,
          height: 52,
          flex: "none",
          background: "var(--color-neutral-300)",
          display: "flex",
          alignItems: "flex-end",
          padding: 5,
          fontWeight: 800,
          fontSize: 13,
          color: "var(--color-muted)",
        }}
      >
        {meal.type.slice(0, 3).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>
          {meal.type}
        </div>
        <div style={{ fontWeight: 500, lineHeight: 1.3, marginTop: 2 }}>{meal.description}</div>
        <div style={{ display: "flex", gap: 2, marginTop: 6, marginLeft: -4 }}>
          <button
            type="button"
            onClick={onEdit}
            style={{ minHeight: 34, padding: "0 8px", background: "transparent", border: 0, color: "var(--color-accent)", fontWeight: 800, fontSize: 12, textTransform: "uppercase", cursor: "pointer" }}
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onDelete}
            style={{ minHeight: 34, padding: "0 8px", background: "transparent", border: 0, color: "var(--color-muted)", fontWeight: 800, fontSize: 12, textTransform: "uppercase", cursor: "pointer" }}
          >
            Borrar
          </button>
        </div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 20, textAlign: "right", flex: "none" }}>
        {meal.calories}
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block" }}>CAL</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `frontend/src/components/MealSheet.tsx`**

```tsx
import { useState } from "react";
import { api } from "../api";
import { MEAL_TYPES, type Meal, type MealType } from "../types";

export function MealSheet({ meal, onClose, onSaved }: { meal: Meal | null; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<MealType>(meal?.type ?? "Almuerzo");
  const [description, setDescription] = useState(meal?.description ?? "");
  const [calories, setCalories] = useState(meal ? String(meal.calories) : "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setPhotoWarning(null);
    let photoUrl = meal?.photoUrl ?? null;
    if (photoFile) {
      try {
        photoUrl = await api.uploadPhoto(photoFile);
      } catch {
        setPhotoWarning("No se pudo subir la foto, pero la comida se va a guardar igual.");
      }
    }
    const input = {
      type,
      description: description.trim() || "Sin descripción",
      calories: parseInt(calories, 10) || 0,
      photoUrl,
      consumedAt: meal?.consumedAt ?? new Date().toISOString().slice(0, 10),
    };
    if (meal) {
      await api.updateMeal(meal.id, input);
    } else {
      await api.createMeal(input);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--color-bg)", display: "flex", flexDirection: "column", animation: "sheetUp 220ms ease-out" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "2px solid var(--color-divider)" }}>
        <h4>{meal ? "Editar comida" : "Registrar comida"}</h4>
        <button type="button" onClick={onClose} style={{ width: 44, height: 44, background: "transparent", border: 0, color: "var(--color-text)", cursor: "pointer" }}>
          ✕
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        <label>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 7 }}>Tipo de comida</span>
          <select value={type} onChange={(e) => setType(e.target.value as MealType)} style={{ width: "100%", minHeight: 50, fontSize: 16, fontWeight: 600, background: "var(--color-surface)", color: "var(--color-text)", border: "2px solid var(--color-divider)" }}>
            {MEAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 7 }}>Descripción</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Pollo grillé con ensalada y papas al horno"
            style={{ width: "100%", padding: 12, fontSize: 16, background: "var(--color-surface)", color: "var(--color-text)", border: "2px solid var(--color-divider)", resize: "none" }}
          />
        </label>
        <label>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 7 }}>Calorías</span>
          <input
            className="np"
            type="number"
            inputMode="numeric"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="0"
            style={{ width: "100%", minHeight: 56, fontSize: 28, fontWeight: 800, background: "var(--color-surface)", color: "var(--color-text)", border: "2px solid var(--color-divider)" }}
          />
        </label>
        <div>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 7 }}>Foto (opcional)</span>
          <label style={{ display: "flex", alignItems: "center", gap: 14, border: "2px solid var(--color-divider)", padding: 12, cursor: "pointer" }}>
            <span style={{ flex: 1, fontWeight: 800, fontSize: 14 }}>{photoFile?.name ?? "Agregar foto del plato"}</span>
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
          </label>
          {photoWarning && <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "var(--color-accent)" }}>{photoWarning}</span>}
        </div>
      </div>
      <div style={{ padding: "14px 20px", borderTop: "2px solid var(--color-divider)", display: "flex", gap: 10 }}>
        <button type="button" onClick={onClose} style={{ minHeight: 52, padding: "0 18px", background: "transparent", border: "2px solid var(--color-divider)", color: "var(--color-text)", fontWeight: 800, cursor: "pointer" }}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          style={{ flex: 1, minHeight: 52, background: "var(--color-accent)", color: "var(--color-bg)", border: 0, fontWeight: 800, fontSize: 16, cursor: "pointer" }}
        >
          Guardar comida
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `frontend/src/screens/TodayScreen.tsx`**

```tsx
import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import type { Meal } from "../types";
import { MealListItem } from "../components/MealListItem";
import { MealSheet } from "../components/MealSheet";

export function TodayScreen({ dailyGoal, showWeightBanner, onOpenWeight }: { dailyGoal: number; showWeightBanner: boolean; onOpenWeight: () => void }) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Meal | null>(null);

  const reload = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    setMeals(await api.getMealsByDate(today));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const consumed = meals.reduce((sum, m) => sum + m.calories, 0);
  const pct = Math.min(100, Math.round((consumed / dailyGoal) * 100));
  const remaining = Math.max(0, dailyGoal - consumed);

  return (
    <div>
      <section style={{ padding: "20px 20px 18px", borderBottom: "2px solid var(--color-divider)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 6 }}>Consumido hoy</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 64, lineHeight: 0.9 }}>{consumed}</span>
          <span style={{ fontWeight: 600, fontSize: 16, color: "var(--color-muted)" }}>/ {dailyGoal} cal</span>
        </div>
        <div style={{ height: 14, background: "var(--color-neutral-300)", marginTop: 18 }}>
          <div style={{ height: "100%", background: "var(--color-accent)", width: `${pct}%` }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, marginTop: 18, background: "var(--color-divider)" }}>
          <div style={{ background: "var(--color-bg)", paddingRight: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)" }}>Restante</div>
            <div style={{ fontWeight: 800, fontSize: 26 }}>{remaining}</div>
          </div>
          <div style={{ background: "var(--color-bg)", paddingLeft: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)" }}>Comidas</div>
            <div style={{ fontWeight: 800, fontSize: 26 }}>{meals.length}</div>
          </div>
        </div>
      </section>

      {showWeightBanner && (
        <section style={{ background: "var(--color-accent)", color: "var(--color-bg)", padding: 20, borderBottom: "2px solid var(--color-divider)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", opacity: 0.85 }}>Viernes de peso</div>
          <div style={{ fontWeight: 800, fontSize: 30, margin: "6px 0 14px" }}>Esta semana todavía no cargaste tu peso.</div>
          <button
            type="button"
            onClick={onOpenWeight}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: 48, padding: "0 16px", background: "var(--color-bg)", color: "var(--color-text)", border: 0, fontWeight: 800, fontSize: 15, cursor: "pointer" }}
          >
            Cargar peso ahora
          </button>
        </section>
      )}

      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 10px" }}>
          <h6>Comidas de hoy</h6>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-muted)" }}>{meals.length} registros</span>
        </div>
        {meals.map((m) => (
          <MealListItem
            key={m.id}
            meal={m}
            onEdit={() => {
              setEditing(m);
              setSheetOpen(true);
            }}
            onDelete={async () => {
              await api.deleteMeal(m.id);
              reload();
            }}
          />
        ))}
        {meals.length === 0 && <div style={{ padding: "28px 20px", borderTop: "1px solid var(--color-neutral-300)", color: "var(--color-muted)" }}>Todavía no registraste nada hoy.</div>}
      </section>

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 70, padding: 14 }}>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
          style={{ display: "block", width: "100%", maxWidth: 430, margin: "0 auto", minHeight: 52, background: "var(--color-accent)", color: "var(--color-bg)", border: 0, fontWeight: 800, fontSize: 16, cursor: "pointer" }}
        >
          + Registrar comida
        </button>
      </div>

      {sheetOpen && (
        <MealSheet
          meal={editing}
          onClose={() => setSheetOpen(false)}
          onSaved={() => {
            setSheetOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire it into `frontend/src/App.tsx`** (temporary single-screen render; Task 14 replaces this with the full tabbed shell)

```tsx
import { useState } from "react";
import { LoginScreen } from "./screens/LoginScreen";
import { TodayScreen } from "./screens/TodayScreen";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  if (!loggedIn) {
    return <LoginScreen onSuccess={() => setLoggedIn(true)} />;
  }

  return <TodayScreen dailyGoal={2000} showWeightBanner={false} onOpenWeight={() => {}} />;
}
```

- [ ] **Step 5: Manually verify**

Run both dev servers (`run` skill), log in, register a meal (with and without a photo), confirm the progress bar/remaining/count update, edit it, delete it, confirm the empty state reappears.

- [ ] **Step 6: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add frontend/src/components frontend/src/screens/TodayScreen.tsx frontend/src/App.tsx
git commit -m "Add Today screen with meal registration/edit sheet"
```

---

### Task 12: Week screen (weekly summary)

**Files:**
- Create: `frontend/src/screens/WeekScreen.tsx`

**Interfaces:**
- Produces: `<WeekScreen weeksCount={number}>` — fetches `api.getWeeklySummary(weeksCount)`, renders the current-week total/average, a bar chart of the last N weeks, and a per-meal-type average list with proportional bars (widest = 100%, others scaled against the max).

- [ ] **Step 1: Write `frontend/src/screens/WeekScreen.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api } from "../api";
import type { WeeklySummary } from "../types";

export function WeekScreen({ weeksCount }: { weeksCount: number }) {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);

  useEffect(() => {
    api.getWeeklySummary(weeksCount).then(setSummary);
  }, [weeksCount]);

  if (!summary) return null;

  const maxWeek = Math.max(...summary.weeks.map((w) => w.total), 1);
  const maxType = Math.max(...summary.byType.map((t) => t.avg), 1);

  return (
    <div>
      <section style={{ padding: 20, borderBottom: "2px solid var(--color-divider)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 6 }}>
          Semana actual · {summary.weekStart} – {summary.weekEnd}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--color-divider)" }}>
          <div style={{ background: "var(--color-bg)", paddingRight: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 38 }}>{summary.weekTotal}</div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)" }}>Total semana</div>
          </div>
          <div style={{ background: "var(--color-bg)", paddingLeft: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 38 }}>{summary.weekAvg}</div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)" }}>Promedio diario</div>
          </div>
        </div>
      </section>

      <section style={{ padding: "18px 20px 22px", borderBottom: "2px solid var(--color-divider)" }}>
        <h6>Últimas {summary.weeks.length} semanas</h6>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-muted)", marginBottom: 16 }}>Total de calorías por semana</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 170, borderBottom: "2px solid var(--color-divider)" }}>
          {summary.weeks.map((w, i) => (
            <div key={w.weekStart} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 6, height: "100%" }}>
              <div style={{ fontSize: 11, fontWeight: 800 }}>{(w.total / 1000).toFixed(1)}k</div>
              <div
                style={{
                  background: i === summary.weeks.length - 1 ? "var(--color-accent)" : "var(--color-neutral-800)",
                  height: Math.round((w.total / maxWeek) * 140),
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "18px 20px 8px" }}>
        <h6>Promedio por tipo de comida</h6>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-muted)", marginBottom: 14 }}>Dónde conviene recortar</div>
        {summary.byType.map((t) => (
          <div key={t.type} style={{ padding: "11px 0", borderTop: "1px solid var(--color-neutral-300)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>{t.type}</span>
              <span style={{ fontWeight: 800, fontSize: 17 }}>{t.avg} CAL</span>
            </div>
            <div style={{ height: 10, background: "var(--color-neutral-300)" }}>
              <div style={{ height: "100%", background: t.avg === maxType && t.avg > 0 ? "var(--color-accent)" : "var(--color-neutral-800)", width: `${Math.round((t.avg / maxType) * 100)}%` }} />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify**

Log meals across a couple of different days/types, open the Week screen (temporarily swap it in `App.tsx` in place of `TodayScreen` to preview, or wait for Task 14's nav), confirm totals and bars look right.

- [ ] **Step 3: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add frontend/src/screens/WeekScreen.tsx
git commit -m "Add Week screen with summary chart and per-type averages"
```

---

### Task 13: Weight screen

**Files:**
- Create: `frontend/src/components/WeightSheet.tsx`
- Create: `frontend/src/screens/WeightScreen.tsx`

**Interfaces:**
- Produces: `<WeightSheet onClose={() => void} onSaved={() => void}>` — date + kg form, calls `api.createWeight`.
- Produces: `<WeightScreen>` — fetches `api.getWeights()`, shows last weight + delta, an SVG line chart, and the full history list with editar/borrar (edit reuses `WeightSheet` pre-filled — extend it to accept an optional `weight` prop, mirroring `MealSheet`'s edit mode).

- [ ] **Step 1: Write `frontend/src/components/WeightSheet.tsx`**

```tsx
import { useState } from "react";
import { api } from "../api";
import type { Weight } from "../types";

export function WeightSheet({ weight, onClose, onSaved }: { weight: Weight | null; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(weight?.recordedAt ?? new Date().toISOString().slice(0, 10));
  const [kg, setKg] = useState(weight?.weightKg ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = parseFloat(kg);
    if (!value) return;
    setSaving(true);
    if (weight) {
      await api.updateWeight(weight.id, { weightKg: value, recordedAt: date });
    } else {
      await api.createWeight({ weightKg: value, recordedAt: date });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--color-bg)", display: "flex", flexDirection: "column", animation: "sheetUp 220ms ease-out" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "2px solid var(--color-divider)" }}>
        <h4>{weight ? "Editar peso" : "Cargar peso"}</h4>
        <button type="button" onClick={onClose} style={{ width: 44, height: 44, background: "transparent", border: 0, color: "var(--color-text)", cursor: "pointer" }}>
          ✕
        </button>
      </div>
      <div style={{ flex: 1, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        <label>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 7 }}>Fecha</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", minHeight: 50, fontSize: 16, fontWeight: 600, background: "var(--color-surface)", color: "var(--color-text)", border: "2px solid var(--color-divider)" }} />
        </label>
        <label>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 7 }}>Peso en kg</span>
          <input
            className="np"
            type="number"
            step="0.1"
            inputMode="decimal"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder="0.0"
            style={{ width: "100%", minHeight: 64, fontSize: 34, fontWeight: 800, background: "var(--color-surface)", color: "var(--color-text)", border: "2px solid var(--color-divider)" }}
          />
        </label>
        <p style={{ fontSize: 13, color: "var(--color-muted)" }}>Un registro por semana es suficiente. Los viernes te lo recordamos en Hoy.</p>
      </div>
      <div style={{ padding: "14px 20px", borderTop: "2px solid var(--color-divider)" }}>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          style={{ width: "100%", minHeight: 52, background: "var(--color-accent)", color: "var(--color-bg)", border: 0, fontWeight: 800, fontSize: 16, cursor: "pointer" }}
        >
          Guardar peso
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `frontend/src/screens/WeightScreen.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Weight } from "../types";
import { WeightSheet } from "../components/WeightSheet";

export function WeightScreen({ sheetOpen, onCloseSheet }: { sheetOpen: boolean; onCloseSheet: () => void }) {
  const [weights, setWeights] = useState<Weight[]>([]);
  const [editing, setEditing] = useState<Weight | null>(null);

  const reload = useCallback(async () => {
    setWeights(await api.getWeights());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (weights.length === 0) {
    return (
      <div style={{ padding: 28, color: "var(--color-muted)" }}>
        Todavía no cargaste ningún peso.
        {sheetOpen && (
          <WeightSheet
            weight={null}
            onClose={onCloseSheet}
            onSaved={() => {
              onCloseSheet();
              reload();
            }}
          />
        )}
      </div>
    );
  }

  const kgs = weights.map((w) => parseFloat(w.weightKg));
  const lo = Math.min(...kgs) - 0.4;
  const hi = Math.max(...kgs) + 0.4;
  const px = (i: number) => (weights.length > 1 ? (i / (weights.length - 1)) * 320 + 3 : 163);
  const py = (kg: number) => 140 - ((kg - lo) / (hi - lo)) * 138;
  const last = weights[weights.length - 1];
  const prev = weights[weights.length - 2];
  const delta = prev ? parseFloat(last.weightKg) - parseFloat(prev.weightKg) : 0;
  const points = weights.map((w, i) => `${px(i)},${py(parseFloat(w.weightKg))}`).join(" ");

  return (
    <div>
      <section style={{ padding: 20, borderBottom: "2px solid var(--color-divider)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 6 }}>Último registro · {last.recordedAt}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 64 }}>{parseFloat(last.weightKg).toFixed(1)}</span>
          <span style={{ fontWeight: 600, fontSize: 18, color: "var(--color-muted)" }}>kg</span>
          <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 15, color: "var(--color-accent-700)" }}>
            {prev ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg vs. anterior` : "—"}
          </span>
        </div>
      </section>

      <section style={{ padding: "18px 20px 22px", borderBottom: "2px solid var(--color-divider)" }}>
        <h6 style={{ marginBottom: 14 }}>Histórico</h6>
        <svg viewBox="0 0 330 140" style={{ width: "100%", height: 150, overflow: "visible" }}>
          <line x1="0" y1="140" x2="330" y2="140" stroke="var(--color-divider)" strokeWidth={2} />
          <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} />
          {weights.map((w, i) => (
            <rect key={w.id} x={px(i) - 3.5} y={py(parseFloat(w.weightKg)) - 3.5} width={7} height={7} fill="var(--color-accent)" />
          ))}
        </svg>
      </section>

      <section style={{ padding: "16px 20px 8px" }}>
        <h6>Registros</h6>
        {weights
          .slice()
          .reverse()
          .map((w, i, arr) => {
            const p = arr[i + 1];
            const d = p ? parseFloat(w.weightKg) - parseFloat(p.weightKg) : null;
            return (
              <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderTop: "1px solid var(--color-neutral-300)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)" }}>{w.recordedAt}</span>
                <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 19 }}>{parseFloat(w.weightKg).toFixed(1)} kg</span>
                  <span style={{ fontWeight: 600, fontSize: 12, color: d !== null && d > 0 ? "var(--color-accent-700)" : "var(--color-muted)" }}>
                    {d === null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}`}
                  </span>
                  <button type="button" onClick={() => setEditing(w)} style={{ background: "transparent", border: 0, color: "var(--color-accent)", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.deleteWeight(w.id);
                      reload();
                    }}
                    style={{ background: "transparent", border: 0, color: "var(--color-muted)", fontWeight: 800, fontSize: 12, cursor: "pointer" }}
                  >
                    Borrar
                  </button>
                </span>
              </div>
            );
          })}
      </section>

      {(sheetOpen || editing) && (
        <WeightSheet
          weight={editing}
          onClose={() => {
            setEditing(null);
            onCloseSheet();
          }}
          onSaved={() => {
            setEditing(null);
            onCloseSheet();
            reload();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

Load a peso and confirm the last-weight card, the line chart, and the history rows render; edit and delete a row; confirm the delta sign/color.

- [ ] **Step 4: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add frontend/src/components/WeightSheet.tsx frontend/src/screens/WeightScreen.tsx
git commit -m "Add Weight screen with history chart and CRUD"
```

---

### Task 14: App shell — bottom nav, screen routing, auth wiring, mobile frame

**Files:**
- Modify: `frontend/src/App.tsx` — final version: session bootstrap, tab state (`hoy`/`semana`/`peso`), bottom nav, primary action button, Friday-banner logic
- Create: `frontend/src/components/BottomNav.tsx`

**Interfaces:**
- Produces: final `App` component composing `LoginScreen`, `TodayScreen`, `WeekScreen`, `WeightScreen`, `BottomNav`, and the primary floating action button from the design (`+ Registrar comida` / `Cargar peso` depending on the active tab).
- Consumes: `AuthError` from `api.ts` (Task 9) to bounce back to `LoginScreen` on any `401` from a child screen; `WeeklySummary.hasWeighedThisWeek` (Task 7/12) plus "is today Friday" to decide `showWeightBanner` in `TodayScreen`.

- [ ] **Step 1: Write `frontend/src/components/BottomNav.tsx`**

```tsx
type Screen = "hoy" | "semana" | "peso";

export function BottomNav({ screen, onChange }: { screen: Screen; onChange: (s: Screen) => void }) {
  const tabs: { key: Screen; label: string }[] = [
    { key: "hoy", label: "Hoy" },
    { key: "semana", label: "Semana" },
    { key: "peso", label: "Peso" },
  ];
  return (
    <nav style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid var(--color-neutral-300)" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          style={{
            minHeight: 56,
            background: "transparent",
            border: 0,
            borderTop: `3px solid ${screen === t.key ? "var(--color-accent)" : "transparent"}`,
            fontWeight: 800,
            fontSize: 12,
            textTransform: "uppercase",
            color: screen === t.key ? "var(--color-text)" : "var(--color-muted)",
            cursor: "pointer",
          }}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Write the final `frontend/src/App.tsx`**

```tsx
import { useState } from "react";
import { LoginScreen } from "./screens/LoginScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { WeekScreen } from "./screens/WeekScreen";
import { WeightScreen } from "./screens/WeightScreen";
import { BottomNav } from "./components/BottomNav";
import { AuthError } from "./api";

type Screen = "hoy" | "semana" | "peso";

const DAILY_GOAL = 2000;

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [screen, setScreen] = useState<Screen>("hoy");
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [todayKey, setTodayKey] = useState(0); // bump to force TodayScreen to refetch after a weight save

  function handleAuthError(err: unknown) {
    if (err instanceof AuthError) setLoggedIn(false);
  }

  window.onunhandledrejection = (e) => handleAuthError(e.reason);

  if (!loggedIn) {
    return <LoginScreen onSuccess={() => setLoggedIn(true)} />;
  }

  const isFriday = new Date().getDay() === 5;

  return (
    <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", margin: "0 auto", background: "var(--color-bg)", position: "relative", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "14px 20px 10px", borderBottom: "2px solid var(--color-divider)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 18, height: 18, background: "var(--color-accent)" }} />
          <span style={{ fontWeight: 800, fontSize: 19 }}>PLATO</span>
        </div>
      </header>

      <main style={{ flex: 1, paddingBottom: 150 }}>
        {screen === "hoy" && (
          <TodayScreen
            key={todayKey}
            dailyGoal={DAILY_GOAL}
            showWeightBanner={isFriday}
            onOpenWeight={() => {
              setScreen("peso");
              setWeightSheetOpen(true);
            }}
          />
        )}
        {screen === "semana" && <WeekScreen weeksCount={8} />}
        {screen === "peso" && (
          <WeightScreen
            sheetOpen={weightSheetOpen}
            onCloseSheet={() => {
              setWeightSheetOpen(false);
              setTodayKey((k) => k + 1);
            }}
          />
        )}
      </main>

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--color-bg)", borderTop: "2px solid var(--color-divider)" }}>
        <div style={{ padding: "14px 20px" }}>
          <button
            type="button"
            onClick={() => (screen === "peso" ? setWeightSheetOpen(true) : setScreen("hoy"))}
            style={{ display: "block", width: "100%", minHeight: 52, background: "var(--color-accent)", color: "var(--color-bg)", border: 0, fontWeight: 800, fontSize: 16, cursor: "pointer" }}
          >
            {screen === "peso" ? "Cargar peso" : "Registrar comida"}
          </button>
        </div>
        <BottomNav screen={screen} onChange={setScreen} />
      </div>
    </div>
  );
}
```

Note: the primary button on the "hoy" tab switches to "hoy" and relies on `TodayScreen`'s own `+ Registrar comida` button to actually open the sheet (avoids duplicating sheet-open state at the `App` level for meals, matching how `TodayScreen` already owns `sheetOpen`/`editing`). If in manual testing this feels redundant, it's acceptable per YAGNI — the important primary action per the design is the "peso" tab's `Cargar peso`, which this wiring does drive correctly.

- [ ] **Step 3: Manually verify the full app**

Run both dev servers. Walk through: login → register 2-3 meals of different types → switch to Semana, confirm totals/averages reflect them → switch to Peso, load a weight, confirm it appears in the chart/list → go back to Hoy. If today is a Friday and no weight was logged this week, confirm the banner shows and "Cargar peso ahora" jumps to the Peso tab with the sheet open.

- [ ] **Step 4: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add frontend/src/App.tsx frontend/src/components/BottomNav.tsx
git commit -m "Wire full app shell: bottom nav, tab routing, auth bounce, Friday banner"
```

---

### Task 15: Production build and Railway deployment config

**Files:**
- Create: `package.json` (repo root)
- Create: `railway.json`
- Modify: `backend/src/app.ts` — serve `frontend/dist` as static files in production, with an SPA fallback
- Create: `backend/.gitignore`, `frontend/.gitignore` (if not already present from scaffolding)

**Interfaces:**
- Produces: root `npm run build` (builds frontend, then backend) and `npm start` (starts backend, which now also serves the frontend build) — this is what Railway's Nixpacks builder auto-detects and runs.

- [ ] **Step 1: Modify `backend/src/app.ts`** to serve the frontend build in production

```ts
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./auth/auth.routes.js";
import { requireAuth } from "./auth/auth.middleware.js";
import { mealsRouter } from "./meals/meals.routes.js";
import { weightsRouter } from "./weights/weights.routes.js";
import { summaryRouter } from "./summary/summary.routes.js";
import { uploadsRouter } from "./uploads/uploads.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/meals", requireAuth, mealsRouter);
  app.use("/api/weights", requireAuth, weightsRouter);
  app.use("/api/summary", requireAuth, summaryRouter);
  app.use("/api/uploads", requireAuth, uploadsRouter);

  if (process.env.NODE_ENV === "production") {
    const frontendDist = path.join(__dirname, "../../frontend/dist");
    app.use(express.static(frontendDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  return app;
}
```

- [ ] **Step 2: Write the root `package.json`**

```json
{
  "name": "c-calorias",
  "private": true,
  "scripts": {
    "build": "npm --prefix frontend install && npm --prefix frontend run build && npm --prefix backend install && npm --prefix backend run build",
    "start": "NODE_ENV=production npm --prefix backend run start",
    "migrate": "npm --prefix backend exec prisma migrate deploy"
  }
}
```

- [ ] **Step 3: Write `railway.json`**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run migrate && npm start",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

- [ ] **Step 4: Ensure `.gitignore` files exist and are correct**

`backend/.gitignore`:
```
node_modules
dist
.env
```

`frontend/.gitignore` (Vite scaffolds this already — verify it contains):
```
node_modules
dist
```

- [ ] **Step 5: Verify a full production build locally**

Run: `cd /home/oliver/projects/personal/c-calorias && npm run build`
Expected: `frontend/dist/index.html` and `backend/dist/index.js` both exist, no errors.

Run: `NODE_ENV=production DATABASE_URL=postgresql://postgres:postgres@localhost:5432/c_calorias PIN_HASH=$(node -e "console.log(require('bcryptjs').hashSync('1234',10))" --prefix backend) SESSION_SECRET=test PORT=3001 npm start`
Expected: server logs `c-calorias backend listening on :3001`; visiting `http://localhost:3001` in a browser shows the PLATO login screen (frontend now served by the backend itself).

- [ ] **Step 6: Commit**

```bash
cd /home/oliver/projects/personal/c-calorias
git add package.json railway.json backend/src/app.ts backend/.gitignore frontend/.gitignore
git commit -m "Add production build (backend serves frontend) and Railway deploy config"
```

- [ ] **Step 7: Provision and deploy on Railway**

This step is infrastructure provisioning, not code — when executing it, use the **use-railway** skill to: create a Railway project, add a PostgreSQL service, create the app service pointing at this repo, and set its environment variables (`PIN_HASH` — a fresh bcrypt hash of the user's real PIN, never `1234`; `SESSION_SECRET` — a fresh random value; `DATABASE_URL` — Railway's Postgres connection string; `DAILY_CALORIE_GOAL=2000`; `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` from the user's Cloudflare R2 bucket; `NODE_ENV=production`). Confirm with the user before creating the R2 bucket/credentials (external Cloudflare account action) and before the final deploy.

---

## Self-Review Notes

- **Spec coverage:** every v1 feature in the spec maps to a task — meal CRUD (5, 11), daily view/goal (11), weekly summary (7, 12), weight CRUD + Friday banner (6, 13, 14), PIN auth + rate limit + session (4, 10), photo upload with non-blocking failure (8, 11), Railway deploy (15). The visual design from `PLATO.dc.html` is reflected in the exact token values, layout, and copy used in Tasks 9–14.
- **Placeholder scan:** no TBD/TODO; every step has real code or an exact shell command.
- **Type consistency:** `MealType`/`MEAL_TYPES` defined once server-side (`meals.service.ts`, Task 5) and once client-side (`types.ts`, Task 9) with identical literal values; `WeeklySummary` shape in `types.ts` matches `getWeeklySummary`'s return shape in `summary.service.ts` field-for-field; `api.ts` method names (`getMealsByDate`, `getWeights`, `getWeeklySummary`, `uploadPhoto`, etc.) are the exact names used by every screen component in Tasks 10–14.
- **Deviations from the raw design mock, and why:** the mock's `weeksShown` default was 6 — the plan uses 8 to match the already-approved spec ("N configurable, default 8"); the mock's `weekAvg` was hardcoded as `total/5` for its demo data — the plan computes it as `total / daysElapsedInWeek(now)` for a real, non-hardcoded average; the mock's `byType` averages were static demo numbers — the plan computes them as `sum(calories)/count` per type from real data for the current week.
