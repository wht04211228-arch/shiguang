import { NextResponse } from "next/server";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createOpaqueToken,
  ensureCollaborationSpace,
  hashCollaborationToken,
  safeTokenHint,
} from "@/lib/collaboration/server";

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ invites: [] });
  const { claims } = await requireUserClaims();
  if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const orderId = new URL(request.url).searchParams.get("orderId")?.trim();
  if (!orderId) return NextResponse.json({ error: "缺少订单编号" }, { status: 400 });
  const admin = createAdminClient();
  const { data: space } = await admin
    .from("collaboration_spaces")
    .select("id")
    .eq("order_id", orderId)
    .eq("owner_id", claims.sub)
    .maybeSingle();
  if (!space) return NextResponse.json({ invites: [] });
  const { data, error } = await admin
    .from("collaboration_invites")
    .select("id,invite_type,label,expected_name,status,deadline_override,opened_at,submitted_at,revoked_at,created_at,token_hint")
    .eq("space_id", space.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invites: data ?? [] });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "云端环境尚未配置" }, { status: 503 });
  }
  const { claims } = await requireUserClaims();
  if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const body = (await request.json()) as {
      orderId?: string;
      type?: "public" | "personal";
      label?: string;
      expectedName?: string;
      deadlineOverride?: string | null;
    };
    if (!body.orderId) throw new Error("缺少订单编号");
    const space = await ensureCollaborationSpace({
      orderId: body.orderId,
      ownerId: claims.sub,
    });
    if (!space.invite_limit) {
      return NextResponse.json(
        { error: "当前订单未购买共创人数，请先补差价开启共创" },
        { status: 402 },
      );
    }
    const admin = createAdminClient();
    const token = createOpaqueToken();
    const { data, error } = await admin
      .from("collaboration_invites")
      .insert({
        space_id: space.id,
        token_hash: hashCollaborationToken(token),
        token_hint: safeTokenHint(token),
        invite_type: body.type === "public" ? "public" : "personal",
        label: body.label?.trim() || (body.type === "public" ? "公共邀请链接" : null),
        expected_name: body.expectedName?.trim() || null,
        deadline_override: body.deadlineOverride || null,
      })
      .select("id,invite_type,label,expected_name,status,deadline_override,created_at")
      .single();
    if (error) throw error;
    const base = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
    return NextResponse.json({
      invite: data,
      token,
      url: `${base}/collaborate/${token}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建邀请失败" },
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
      inviteId?: string;
      orderId?: string;
      action?: "revoke" | "extend";
      deadline?: string | null;
    };
    if (!body.inviteId || !body.orderId) throw new Error("邀请信息不完整");
    const admin = createAdminClient();
    const { data: space } = await admin
      .from("collaboration_spaces")
      .select("id")
      .eq("order_id", body.orderId)
      .eq("owner_id", claims.sub)
      .maybeSingle();
    if (!space) throw new Error("共创空间不存在");
    const patch =
      body.action === "revoke"
        ? { status: "revoked", revoked_at: new Date().toISOString() }
        : { deadline_override: body.deadline || null, status: "active" };
    const { error } = await admin
      .from("collaboration_invites")
      .update(patch)
      .eq("id", body.inviteId)
      .eq("space_id", space.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新邀请失败" },
      { status: 400 },
    );
  }
}
