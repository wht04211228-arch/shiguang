import { NextRequest, NextResponse } from "next/server";
import { requirePublicCardAccess } from "@/lib/cards/public-access";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

const categories = new Set([
  "privacy",
  "copyright",
  "harassment",
  "unsafe",
  "illegal",
  "other",
]);

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ submitted: true, demo: true });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      slug?: string;
      category?: string;
      detail?: string;
      contributionId?: string;
      recipientEntryId?: string;
    };
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    if (!slug) throw new Error("缺少礼物链接信息");
    const category = categories.has(body.category || "") ? body.category! : "other";
    const detail = typeof body.detail === "string" ? body.detail.trim().slice(0, 2000) : "";
    if (detail.length < 8) throw new Error("请至少说明8个字，帮助管理员判断问题");
    const access = await requirePublicCardAccess(request, slug);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const { claims } = await requireUserClaims();
    const immediateHide = ["privacy", "unsafe", "illegal"].includes(category);

    let contributionId: string | null = null;
    if (body.contributionId) {
      const { data } = await access.admin
        .from("collaboration_contributions")
        .select("id,space_id,collaboration_spaces!inner(card_id)")
        .eq("id", body.contributionId)
        .eq("collaboration_spaces.card_id", access.card.id)
        .maybeSingle();
      contributionId = data?.id ?? null;
    }
    let recipientEntryId: string | null = null;
    if (body.recipientEntryId) {
      const { data } = await access.admin
        .from("recipient_entries")
        .select("id")
        .eq("id", body.recipientEntryId)
        .eq("card_id", access.card.id)
        .maybeSingle();
      recipientEntryId = data?.id ?? null;
    }

    const { data: report, error } = await access.admin
      .from("content_reports")
      .insert({
        reporter_user_id: claims?.sub ?? null,
        card_id: access.card.id,
        contribution_id: contributionId,
        recipient_entry_id: recipientEntryId,
        category,
        detail,
        temporary_hidden: immediateHide,
      })
      .select("id,status,temporary_hidden")
      .single();
    if (error) throw error;
    if (immediateHide && contributionId) {
      await access.admin
        .from("collaboration_contributions")
        .update({ status: "hidden", hidden_at: new Date().toISOString() })
        .eq("id", contributionId);
    }
    if (immediateHide && recipientEntryId) {
      await access.admin
        .from("recipient_entries")
        .update({ status: "moderated" })
        .eq("id", recipientEntryId);
    }
    return NextResponse.json({ submitted: true, report });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "提交举报失败" },
      { status: 400 },
    );
  }
}
