import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function verifyPin(pin: string): boolean {
  return bcrypt.compareSync(pin, config.pinHash);
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
