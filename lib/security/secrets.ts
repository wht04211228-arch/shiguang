import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { getSupabaseServerSecret } from "@/lib/supabase/config";

function normalizeAnswer(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN");
}

export function hashAnswer(answer: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalizeAnswer(answer), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyAnswer(answer: string, stored: string | null): boolean {
  if (!stored) return true;
  const [scheme, salt, expectedHex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  const actual = scryptSync(normalizeAnswer(answer), salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function accessSecret(): string {
  return (
    process.env.CARD_ACCESS_SECRET ||
    getSupabaseServerSecret() ||
    "development-only-card-access-secret-change-me"
  );
}

export function accessCookieName(slug: string): string {
  return `sg_access_${createHash("sha256").update(slug).digest("hex").slice(0, 18)}`;
}

export function createAccessToken(
  cardId: string,
  maxAgeSeconds = 60 * 60 * 24 * 30,
): string {
  const payload = Buffer.from(
    JSON.stringify({
      cardId,
      exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", accessSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAccessToken(
  token: string | undefined,
  cardId: string,
): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", accessSecret())
    .update(payload)
    .digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return false;
  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as {
      cardId?: string;
      exp?: number;
    };
    return (
      decoded.cardId === cardId &&
      Number(decoded.exp) > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}
