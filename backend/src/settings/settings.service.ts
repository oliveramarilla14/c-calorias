import { prisma } from "../db.js";
import { config } from "../config.js";
import { encryptSecret, decryptSecret } from "./crypto.js";

const PIN_HASH_KEY = "pin_hash";
const OPENAI_API_KEY = "openai_api_key";

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

export function _resetCacheForTests(): void {
  cache.clear();
  loaded = false;
}
