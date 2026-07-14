import { NextRequest, NextResponse } from "next/server";
import { requirePublicCardAccess } from "@/lib/cards/public-access";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

type RequestType =
  | "recipient_invite_permission"
  | "transfer_primary_manager"
  | "permanent_close"
  | "permanent_delete"
  | "full_export"
  | "remove_manager";

const validTypes = new Set<RequestType>([
  "recipient_invite_permission",
  "transfer_primary_manager",
  "permanent_close",
  "permanent_delete",
  "full_export",
  "remove_manager",
]);

function deadlineFor(type: RequestType) {
  const days = type === "permanent_delete" ? 30 : 14;
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ requests: [] });
  try {
    const access = await requirePublicCardAccess(request, slug);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const { claims } = await requireUserClaims();
    if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (![access.card.owner_id, access.card.recipient_owner_id].includes(claims.sub)) {
      return NextResponse.json({ error: "没有管理权限" }, { status: 403 });
    }
    const { data, error } = await access.admin
      .from("management_requests")
      .select("id,requester_id,target_user_id,request_type,payload,status,response_deadline,responded_at,created_at")
      .eq("card_id", access.card.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ requests: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取申请失败" },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "云端环境尚未配置" }, { status: 503 });
  }
  try {
    const access = await requirePublicCardAccess(request, slug);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const { claims } = await requireUserClaims();
    if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (![access.card.owner_id, access.card.recipient_owner_id].includes(claims.sub)) {
      return NextResponse.json({ error: "没有发起管理申请的权限" }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as {
      requestType?: RequestType;
      payload?: Record<string, unknown>;
    };
    const requestType = body.requestType as RequestType;
    if (!validTypes.has(requestType)) throw new Error("不支持这种申请类型");
    const targetUserId =
      claims.sub === access.card.owner_id
        ? access.card.recipient_owner_id
        : access.card.owner_id;
    if (!targetUserId && requestType !== "recipient_invite_permission") {
      throw new Error("对方尚未绑定账号，暂时无法发起双方确认");
    }
    const { data, error } = await access.admin
      .from("management_requests")
      .insert({
        card_id: access.card.id,
        requester_id: claims.sub,
        target_user_id: targetUserId,
        request_type: requestType,
        payload: body.payload ?? {},
        response_deadline: deadlineFor(requestType),
      })
      .select("id,status,response_deadline")
      .single();
    if (error) throw error;
    return NextResponse.json({ request: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "提交申请失败" },
      { status: 400 },
    );
  }
}
