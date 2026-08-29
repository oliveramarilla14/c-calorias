import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { getPinHash } from "../settings/settings.service.js";

export async function verifyPin(pin: string): Promise<boolean> {
  const hash = await getPinHash();
  if (!hash) return false;
  return bcrypt.compareSync(pin, hash);
}

export function signSession(): string {
  return jwt.sign({ auth: true }, config.sessionSecret, { expiresIn: "24h" });
}

export function verifySession(token: string): boolean {
  try {
    jwt.verify(token, config.sessionSecret);
    return true;
  } catch {
    return false;
  }
}
