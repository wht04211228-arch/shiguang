import { NextResponse } from "next/server";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import {
  ensureCollaborationSpace,
  getSpaceSummary,
  listContributions,
} from "@/lib/collaboration/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ cloudMode: false, space: null, contributions: [] });
  }
  const { claims } = await requireUserClaims();
  if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const orderId = new URL(request.url).searchParams.get("orderId")?.trim();
  if (!orderId) return NextResponse.json({ error: "缺少订单编号" }, { status: 400 });
  try {
    const space = await getSpaceSummary(orderId, claims.sub);
    const contributions = space ? await listContributions(space.id) : [];
    return NextResponse.json({ cloudMode: true, space, contributions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取共创空间失败" },
      { status: 400 },
    );
  }
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
      mode?: "secret" | "wall";
      deadline?: string | null;
      submissionsOpen?: boolean;
      allowExistingEditsAfterDeadline?: boolean;
      lock?: boolean;
    };
    if (!body.orderId) throw new Error("缺少订单编号");
    const space = await ensureCollaborationSpace({
      orderId: body.orderId,
      ownerId: claims.sub,
      mode: body.mode,
      deadline: body.deadline,
    });
    const admin = createAdminClient();
    const patch: Record<string, unknown> = {};
    if (body.mode) patch.mode = body.mode;
    if (body.deadline !== undefined) patch.contribution_deadline = body.deadline || null;
    if (typeof body.submissionsOpen === "boolean") patch.submissions_open = body.submissionsOpen;
    if (typeof body.allowExistingEditsAfterDeadline === "boolean") {
      patch.allow_existing_edits_after_deadline = body.allowExistingEditsAfterDeadline;
    }
    if (body.lock) {
      patch.locked_at = new Date().toISOString();
      patch.submissions_open = false;
    }
    if (Object.keys(patch).length) {
      const { error } = await admin
        .from("collaboration_spaces")
        .update(patch)
        .eq("id", space.id)
        .eq("owner_id", claims.sub);
      if (error) throw error;
    }
    const summary = await getSpaceSummary(body.orderId, claims.sub);
    return NextResponse.json({ space: summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存共创设置失败" },
      { status: 400 },
    );
  }
}
