import { NextResponse } from "next/server";
import {
  allowedConversionEvents,
  recordConversionEvent,
} from "@/lib/analytics/events";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: string;
    eventName?: string;
    path?: string;
    referrer?: string | null;
    metadata?: Record<string, unknown>;
  };
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ ok: true, demo: true });
  if (
    !body.sessionId ||
    body.sessionId.length < 8 ||
    !body.eventName ||
    !allowedConversionEvents.has(body.eventName)
  ) {
    return NextResponse.json({ error: "无效事件" }, { status: 400 });
  }
  const { claims } = await requireUserClaims();
  await recordConversionEvent({
    sessionId: body.sessionId,
    eventName: body.eventName,
    path: body.path,
    referrer: body.referrer,
    userId: claims?.sub ?? null,
    metadata: body.metadata,
  });
  return NextResponse.json({ ok: true });
}
