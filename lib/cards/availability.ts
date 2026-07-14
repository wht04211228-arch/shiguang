export type CardAvailability =
  | { state: "available" }
  | { state: "pending"; releaseAt: string }
  | { state: "expired"; expiresAt: string };

export function getCardAvailability(input: {
  release_at?: string | null;
  expires_at?: string | null;
}): CardAvailability {
  const now = Date.now();
  if (input.expires_at) {
    const expiresAt = Date.parse(input.expires_at);
    if (Number.isFinite(expiresAt) && expiresAt <= now) {
      return { state: "expired", expiresAt: input.expires_at };
    }
  }
  if (input.release_at) {
    const releaseAt = Date.parse(input.release_at);
    if (Number.isFinite(releaseAt) && releaseAt > now) {
      return { state: "pending", releaseAt: input.release_at };
    }
  }
  return { state: "available" };
}
