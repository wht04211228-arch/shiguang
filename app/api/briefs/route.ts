import { NextResponse } from "next/server";
import { recordConversionEvent } from "@/lib/analytics/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

const themes = new Set(["cinema", "starlight", "film", "unsure"]);
const tones = new Set(["warm", "romantic", "restrained", "playful", "solemn"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ ok: true, demo: true });
  }
  const { supabase, claims } = await requireUserClaims();
  if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const recipientName = typeof body.recipientName === "string" ? body.recipientName.trim() : "";
  const relationship = typeof body.relationship === "string" ? body.relationship.trim() : "";
  const occasion = typeof body.occasion === "string" ? body.occasion.trim() : "";
  if (!orderId || !recipientName || !relationship || !occasion) {
    return NextResponse.json({ error: "需求信息不完整" }, { status: 400 });
  }
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,status")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order || !["paid", "in_progress", "fulfilled"].includes(order.status)) {
    return NextResponse.json({ error: "只有已支付订单可以提交制作需求" }, { status: 403 });
  }
  const submit = body.submit === true;
  const storyFacts = Array.isArray(body.storyFacts)
    ? body.storyFacts.filter((item): item is string => typeof item === "string").slice(0, 100)
    : [];
  if (submit && storyFacts.length < 2) {
    return NextResponse.json({ error: "至少需要两条真实回忆" }, { status: 400 });
  }
  const preferredTheme = typeof body.preferredTheme === "string" && themes.has(body.preferredTheme)
    ? body.preferredTheme
    : "film";
  const tone = typeof body.tone === "string" && tones.has(body.tone) ? body.tone : "warm";
  const row = {
    order_id: orderId,
    owner_id: claims.sub,
    recipient_name: recipientName.slice(0, 100),
    relationship: relationship.slice(0, 100),
    occasion: occasion.slice(0, 100),
    delivery_date: typeof body.deliveryDate === "string" && body.deliveryDate ? body.deliveryDate : null,
    preferred_theme: preferredTheme,
    tone,
    story_facts: storyFacts.map((item) => item.slice(0, 800)),
    must_include: typeof body.mustInclude === "string" ? body.mustInclude.slice(0, 3000) : null,
    avoid_content: typeof body.avoidContent === "string" ? body.avoidContent.slice(0, 3000) : null,
    contact_method: typeof body.contactMethod === "string" ? body.contactMethod.slice(0, 300) : null,
    special_requests: typeof body.specialRequests === "string" ? body.specialRequests.slice(0, 3000) : null,
    status: submit ? "submitted" : "draft",
    submitted_at: submit ? new Date().toISOString() : null,
  };
  const { error } = await supabase.from("order_briefs").upsert(row, { onConflict: "order_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (submit) {
    const admin = createAdminClient();
    await admin.from("orders").update({ service_stage: "brief_submitted" }).eq("id", orderId);
    const { count: taskCount } = await admin.from("production_tasks").select("id", { count: "exact", head: true }).eq("order_id", orderId);
    if (!taskCount) {
      await admin.from("production_tasks").insert([
        { order_id: orderId, title: "核对问卷与素材完整性", status: "todo", priority: "high", sort_order: 10 },
        { order_id: orderId, title: "整理故事结构与章节顺序", status: "todo", priority: "normal", sort_order: 20 },
        { order_id: orderId, title: "完成页面制作并内部校对", status: "todo", priority: "normal", sort_order: 30 },
      ]);
    }
    await admin.from("order_events").insert({ order_id: orderId, event_type: "brief.submitted", payload: { recipientName, occasion } });
    await recordConversionEvent({
      sessionId: `server-${orderId}`,
      eventName: "brief_submitted",
      path: "/brief",
      userId: claims.sub,
      metadata: { orderId, preferredTheme, tone },
    });
  }
  return NextResponse.json({ ok: true, submitted: submit });
}
