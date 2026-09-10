import { prisma } from "../db.js";
import { config } from "../config.js";
import { encryptSecret, decryptSecret } from "./crypto.js";

const PIN_HASH_KEY = "pin_hash";
const OPENAI_API_KEY = "openai_api_key";
const DAILY_GOAL_KEY = "daily_goal";
const MAINTENANCE_KEY = "maintenance_calories";

export const DEFAULT_DAILY_GOAL = 2000;
export const DEFAULT_MAINTENANCE_CALORIES = 2500;

/** Energy density of body tissue: kcal per kg, the usual 7700 rule of thumb. */
export const KCAL_PER_KG = 7700;

const cache = new Map<string, string>();
let loaded = false;

async function load(): Promise<void> {
  if (loaded) return;
  const rows = await prisma.setting.findMany();
  for (const row of rows) cache.set(row.key, row.value);
  loaded = true;
}

async function readRaw(key: string): Promise<string | undefined> {
  await load();
  return cache.get(key);
}

async function write(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  cache.set(key, value);
  loaded = true;
}

async function remove(key: string): Promise<void> {
  await prisma.setting.deleteMany({ where: { key } });
  cache.delete(key);
}

export async function getPinHash(): Promise<string | undefined> {
  return (await readRaw(PIN_HASH_KEY)) ?? config.pinHash;
}

export async function setPinHash(hash: string): Promise<void> {
  await write(PIN_HASH_KEY, hash);
}

export interface AiKeyStatus {
  configured: boolean;
  preview: string | null;
  source: "db" | "env" | null;
}

export async function getOpenAiApiKey(): Promise<string | undefined> {
  const stored = await readRaw(OPENAI_API_KEY);
  if (stored) return decryptSecret(stored);
  return config.openaiApiKey;
}

export async function setOpenAiApiKey(plain: string): Promise<void> {
  await write(OPENAI_API_KEY, encryptSecret(plain));
}

export async function clearOpenAiApiKey(): Promise<void> {
  await remove(OPENAI_API_KEY);
}

export async function getAiKeyStatus(): Promise<AiKeyStatus> {
  const stored = await readRaw(OPENAI_API_KEY);
  const key = stored ? decryptSecret(stored) : config.openaiApiKey;
  if (!key) return { configured: false, preview: null, source: null };
  const preview = key.length <= 8 ? "…" : `${key.slice(0, 3)}…${key.slice(-4)}`;
  return { configured: true, preview, source: stored ? "db" : "env" };
}

export interface Goals {
  dailyGoal: number;
  maintenanceCalories: number;
}

async function readNumber(key: string, fallback: number): Promise<number> {
  const raw = await readRaw(key);
  const n = Number(raw);
  return raw !== undefined && Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

export async function getGoals(): Promise<Goals> {
  return {
    dailyGoal: await readNumber(DAILY_GOAL_KEY, DEFAULT_DAILY_GOAL),
    maintenanceCalories: await readNumber(MAINTENANCE_KEY, DEFAULT_MAINTENANCE_CALORIES),
  };
}

export async function setGoals(goals: Goals): Promise<void> {
  await write(DAILY_GOAL_KEY, String(goals.dailyGoal));
  await write(MAINTENANCE_KEY, String(goals.maintenanceCalories));
}

export function _resetCacheForTests(): void {
  cache.clear();
  loaded = false;
}
