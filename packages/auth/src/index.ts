import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) throw new Error("有効なメールアドレスが必要です");
  return normalized;
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error("パスワードは12文字以上にしてください");
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, nText, rText, pText, saltText, hashText] = encoded.split("$");
  if (algorithm !== "scrypt" || !nText || !rText || !pText || !saltText || !hashText) return false;
  const n = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  try {
    const expected = Buffer.from(hashText, "base64url");
    const actual = await deriveKey(password, Buffer.from(saltText, "base64url"), expected.length, { N: n, r, p });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

interface SessionPayload { sub: string; exp: number; }

export function createSessionToken(subject: string, secret: string, nowMs = Date.now(), ttlSec = 60 * 60 * 24 * 7): string {
  if (!subject || !secret) throw new Error("session subjectとsecretは必須です");
  const payload: SessionPayload = { sub: subject, exp: Math.floor(nowMs / 1000) + ttlSec };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifySessionToken(token: string, secret: string, nowMs = Date.now()): { subject: string; expiresAt: number } | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !secret) return null;
  const expected = sign(encoded, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.sub || !Number.isInteger(payload.exp) || payload.exp <= Math.floor(nowMs / 1000)) return null;
    return { subject: payload.sub, expiresAt: payload.exp };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, maxAgeSec = 60 * 60 * 24 * 7, secure = true): string {
  return `sf_session=${encodeURIComponent(token)}; Max-Age=${maxAgeSec}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function deriveKey(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived as Buffer);
    });
  });
}
