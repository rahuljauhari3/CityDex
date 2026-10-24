/**
 * AES-256-GCM for provider tokens at rest (PLAN.md §10). Key comes from
 * TOKEN_ENC_KEY (32 bytes, base64). In demo mode without a key, a fixed dev
 * key is derived so local testing works; never rely on that in production.
 */

import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

function key(): Buffer {
  const raw = process.env.TOKEN_ENC_KEY?.trim();
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("TOKEN_ENC_KEY must be 32 bytes, base64-encoded.");
    return buf;
  }
  return scryptSync("citydex-dev-only-key", "citydex", 32);
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decrypt(token: string): string {
  const [iv, tag, data] = token.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
