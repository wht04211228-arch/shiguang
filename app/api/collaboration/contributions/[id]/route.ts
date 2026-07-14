import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserClaims } from "@/lib/supabase/auth";
import { hashCollaborationToken } from "@/lib/collaboration/server";
import { moderateContributionText } from "@/lib/collaboration/moderation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = (await request.json()) as {
      action?: "approve" | "hide" | "request_changes" | "delete" | "reorder" | "edit" | "approve_withdrawal";
      note?: string;
      sortOrder?: number;
      editToken?: string;
      displayName?: string;
      message?: string;
      anonymousToRecipient?: boolean;
      media?: unknown;
    };
    const admin = createAdminClient();
    const { data: row, error: readError } = await admin
      .from("collaboration_contributions")
      .select("*, collaboration_spaces(owner_id,locked_at,recipient_opened_at)")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!row) return NextResponse.json({ error: "投稿不存在" }, { status: 404 });

    if (body.action === "edit") {
      if (row.collaboration_spaces?.locked_at) {
        return NextResponse.json({ error: "礼物已经锁定，不能直接修改投稿" }, { status: 409 });
      }
      const { claims } = await requireUserClaims();
      const accountMatches = Boolean(claims?.sub && row.submitter_user_id === claims.sub);
      const tokenMatches = Boolean(
        body.editToken &&
          row.guest_edit_token_hash &&
          hashCollaborationToken(body.editToken) === row.guest_edit_token_hash,
      );
      if (!accountMatches && !tokenMatches) {
        return NextResponse.json({ error: "没有修改这份投稿的权限" }, { status: 403 });
      }
      const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : row.display_name;
      const message = typeof body.message === "string" ? body.message.trim().slice(0, 5000) : row.message;
      if (!displayName || message.length < 2) throw new Error("投稿内容不完整");
      const moderation = await moderateContributionText(`${displayName}\n${message}`);
      if (!moderation.allowed) {
        return NextResponse.json({ error: "修改内容没有通过安全检查", reasons: moderation.reasons }, { status: 422 });
      }
      await admin.from("contribution_versions").insert({
        contribution_id: row.id,
        actor_user_id: claims?.sub || null,
        actor_type: claims?.sub ? "participant" : "guest",
        snapshot: {
          displayName: row.display_name,
          message: row.message,
          media: row.media,
          anonymousToRecipient: row.anonymous_to_recipient,
        },
        reason: "投稿者修改前版本",
      });
      const { error } = await admin
        .from("collaboration_contributions")
        .update({
          display_name: displayName,
          message,
          media: Array.isArray(body.media) ? body.media.slice(0, 5) : row.media,
          anonymous_to_recipient:
            typeof body.anonymousToRecipient === "boolean"
              ? body.anonymousToRecipient
              : row.anonymous_to_recipient,
          status: "submitted",
          moderation_note: `文字检查：${moderation.provider}`,
        })
        .eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const { claims } = await requireUserClaims();
    if (!claims?.sub || row.collaboration_spaces?.owner_id !== claims.sub) {
      return NextResponse.json({ error: "只有购买者可以管理投稿" }, { status: 403 });
    }
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 600) : null;
    let patch: Record<string, unknown>;
    if (body.action === "approve") {
      patch = { status: "approved", approved_at: new Date().toISOString(), moderation_note: note };
    } else if (body.action === "hide") {
      patch = { status: "hidden", hidden_at: new Date().toISOString(), moderation_note: note };
    } else if (body.action === "request_changes") {
      patch = { status: "changes_requested", moderation_note: note || "请修改后重新提交" };
    } else if (body.action === "delete") {
      patch = { status: "deleted", hidden_at: new Date().toISOString(), moderation_note: note };
    } else if (body.action === "reorder") {
      patch = { sort_order: Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : row.sort_order };
    } else if (body.action === "approve_withdrawal") {
      if (row.status !== "withdrawal_pending") throw new Error("当前投稿没有待处理撤回申请");
      patch = {
        status: "withdrawn",
        withdrawn_at: new Date().toISOString(),
        hidden_at: new Date().toISOString(),
        moderation_note: note || "购买者确认撤回",
      };
      await admin
        .from("contribution_withdrawals")
        .update({
          status: "approved",
          resolved_by: claims.sub,
          resolved_at: new Date().toISOString(),
          resolution_note: note || "确认永久撤回",
        })
        .eq("contribution_id", row.id)
        .eq("status", "pending");
    } else {
      return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
    }
    const { error } = await admin
      .from("collaboration_contributions")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
    await admin.from("contribution_versions").insert({
      contribution_id: row.id,
      actor_user_id: claims.sub,
      actor_type: "owner",
      snapshot: { beforeStatus: row.status, action: body.action, note },
      reason: `购买者操作：${body.action}`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新投稿失败" },
      { status: 400 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = (await request.json()) as { editToken?: string; reason?: string };
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("collaboration_contributions")
      .select("*, collaboration_spaces(recipient_opened_at)")
      .eq("id", id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "投稿不存在" }, { status: 404 });
    const { claims } = await requireUserClaims();
    const accountMatches = Boolean(claims?.sub && row.submitter_user_id === claims.sub);
    const tokenMatches = Boolean(
      body.editToken &&
        row.guest_edit_token_hash &&
        hashCollaborationToken(body.editToken) === row.guest_edit_token_hash,
    );
    if (!accountMatches && !tokenMatches) {
      return NextResponse.json({ error: "没有撤回权限" }, { status: 403 });
    }
    const alreadyOpened = Boolean(row.collaboration_spaces?.recipient_opened_at);
    if (!alreadyOpened) {
      await admin
        .from("collaboration_contributions")
        .update({ status: "withdrawn", withdrawn_at: new Date().toISOString(), hidden_at: new Date().toISOString() })
        .eq("id", id);
      return NextResponse.json({ ok: true, status: "withdrawn" });
    }
    const requesterTokenHash = accountMatches || !body.editToken ? null : hashCollaborationToken(body.editToken);
    const { error } = await admin.from("contribution_withdrawals").insert({
      contribution_id: id,
      requester_user_id: claims?.sub || null,
      requester_token_hash: requesterTokenHash,
      reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : null,
    });
    if (error) throw error;
    await admin
      .from("collaboration_contributions")
      .update({ status: "withdrawal_pending", hidden_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ ok: true, status: "withdrawal_pending" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "撤回申请失败" },
      { status: 400 },
    );
  }
}
