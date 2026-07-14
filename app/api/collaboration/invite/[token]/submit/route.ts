import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createOpaqueToken,
  findInviteByToken,
  hashCollaborationToken,
  isInviteAccepting,
} from "@/lib/collaboration/server";
import { moderateContributionText } from "@/lib/collaboration/moderation";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const result = await findInviteByToken(token);
    if (!result) return NextResponse.json({ error: "邀请链接不存在" }, { status: 404 });
    const { invite, space } = result;
    const body = (await request.json()) as {
      displayName?: string;
      message?: string;
      anonymousToRecipient?: boolean;
      media?: unknown;
      bindAccount?: boolean;
    };
    const displayName = clean(body.displayName, 80);
    const message = clean(body.message, 5000);
    if (!displayName) throw new Error("请填写你的昵称或身份");
    if (message.length < 2) throw new Error("至少写下一句想对TA说的话");
    const media = Array.isArray(body.media) ? body.media.slice(0, 5) : [];
    const imageCount = media.filter((item: any) => item?.type === "image").length;
    const audioCount = media.filter((item: any) => item?.type === "audio").length;
    if (imageCount > 3) throw new Error("每位参与者最多提交3张照片");
    if (audioCount > 1) throw new Error("每位参与者最多提交1段语音");

    const admin = createAdminClient();
    const { count } = await admin
      .from("collaboration_contributions")
      .select("id", { count: "exact", head: true })
      .eq("space_id", space.id)
      .not("status", "in", '("deleted","withdrawn")');
    const acceptance = isInviteAccepting({ space, invite });
    if (!acceptance.allowed) {
      return NextResponse.json({ error: acceptance.reason }, { status: 403 });
    }
    if ((count ?? 0) >= space.invite_limit) {
      return NextResponse.json({ error: "共创人数已经达到当前档位上限" }, { status: 409 });
    }

    const moderation = await moderateContributionText(`${displayName}\n${message}`);
    if (!moderation.allowed) {
      return NextResponse.json(
        { error: "这段内容没有通过安全检查", reasons: moderation.reasons },
        { status: 422 },
      );
    }

    let submitterUserId: string | null = null;
    if (body.bindAccount && isSupabaseAdminConfigured()) {
      const { claims } = await requireUserClaims();
      submitterUserId = claims?.sub || null;
    }
    const editToken = createOpaqueToken();
    const { data, error } = await admin
      .from("collaboration_contributions")
      .insert({
        space_id: space.id,
        invite_id: invite?.id || null,
        submitter_user_id: submitterUserId,
        guest_edit_token_hash: hashCollaborationToken(editToken),
        display_name: displayName,
        anonymous_to_recipient: body.anonymousToRecipient === true,
        message,
        media,
        status: "submitted",
        sort_order: (count ?? 0) + 1,
        moderation_note: `文字检查：${moderation.provider}`,
      })
      .select("id,status,created_at")
      .single();
    if (error) throw error;

    await admin.from("contribution_versions").insert({
      contribution_id: data.id,
      actor_user_id: submitterUserId,
      actor_type: submitterUserId ? "participant" : "guest",
      snapshot: { displayName, message, media, anonymousToRecipient: body.anonymousToRecipient === true },
      reason: "首次投稿",
    });
    if (invite) {
      await admin
        .from("collaboration_invites")
        .update({ status: "submitted", submitted_at: new Date().toISOString() })
        .eq("id", invite.id);
    }
    return NextResponse.json({
      contribution: data,
      editToken,
      message: "投稿已送达购买者，正式发布前会由购买者确认。",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "提交投稿失败" },
      { status: 400 },
    );
  }
}
