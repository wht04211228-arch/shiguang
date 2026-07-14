import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

async function ownerCard(orderId: string, userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cards")
    .select("id,slug,owner_id,recipient_owner_id,primary_manager_id,management_phase,status")
    .eq("order_id", orderId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw error;
  return { admin, card: data };
}

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ requests: [] });
  const { claims } = await requireUserClaims();
  if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const orderId = new URL(request.url).searchParams.get("orderId")?.trim();
  if (!orderId) return NextResponse.json({ error: "缺少订单编号" }, { status: 400 });
  try {
    const { admin, card } = await ownerCard(orderId, claims.sub);
    if (!card) return NextResponse.json({ requests: [], card: null });
    const { data, error } = await admin
      .from("management_requests")
      .select("id,requester_id,target_user_id,request_type,payload,status,response_deadline,responded_at,created_at")
      .eq("card_id", card.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ requests: data ?? [], card });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取共同管理申请失败" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "云端环境尚未配置" }, { status: 503 });
  }
  const { claims } = await requireUserClaims();
  if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const body = (await request.json()) as {
      orderId?: string;
      requestId?: string;
      action?: "approve" | "reject";
      note?: string;
    };
    if (!body.orderId || !body.requestId || !body.action) {
      throw new Error("申请处理信息不完整");
    }
    const { admin, card } = await ownerCard(body.orderId, claims.sub);
    if (!card) throw new Error("没有找到对应礼物");
    const { data: item, error: itemError } = await admin
      .from("management_requests")
      .select("*")
      .eq("id", body.requestId)
      .eq("card_id", card.id)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new Error("申请不存在");
    if (item.status !== "pending") throw new Error("该申请已经处理");
    if (item.target_user_id && item.target_user_id !== claims.sub) {
      throw new Error("这项申请需要由指定的另一方确认");
    }

    const now = new Date().toISOString();
    const nextStatus = body.action === "approve" ? "approved" : "rejected";
    const { error: updateError } = await admin
      .from("management_requests")
      .update({
        status: nextStatus,
        responded_at: now,
        payload: {
          ...(item.payload ?? {}),
          responseNote: typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "",
        },
      })
      .eq("id", item.id);
    if (updateError) throw updateError;

    if (body.action === "approve") {
      if (item.request_type === "recipient_invite_permission" && item.requester_id) {
        const { data: member } = await admin
          .from("memory_space_members")
          .select("permissions")
          .eq("card_id", card.id)
          .eq("user_id", item.requester_id)
          .maybeSingle();
        await admin.from("memory_space_members").upsert(
          {
            card_id: card.id,
            user_id: item.requester_id,
            role: "recipient",
            status: "active",
            permissions: {
              ...(member?.permissions ?? {}),
              invite_approved: true,
            },
            accepted_at: now,
          },
          { onConflict: "card_id,user_id" },
        );
      }
      if (item.request_type === "transfer_primary_manager" && item.requester_id) {
        await admin
          .from("cards")
          .update({
            primary_manager_id: item.requester_id,
            management_phase:
              item.requester_id === card.recipient_owner_id
                ? "recipient_managed"
                : "co_managed",
          })
          .eq("id", card.id);
      }
      if (item.request_type === "permanent_close") {
        await admin
          .from("cards")
          .update({ status: "archived", expires_at: now })
          .eq("id", card.id);
      }
      if (item.request_type === "full_export") {
        await admin
          .from("management_requests")
          .update({ status: "completed" })
          .eq("id", item.id);
      }
      if (item.request_type === "permanent_delete") {
        // 双方确认后先归档并冻结；管理员可在30天申诉窗口结束后执行物理删除。
        await admin
          .from("cards")
          .update({ status: "archived", expires_at: now })
          .eq("id", card.id);
      }
    }
    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "处理申请失败" },
      { status: 400 },
    );
  }
}
