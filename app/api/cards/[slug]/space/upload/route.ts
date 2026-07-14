import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requirePublicCardAccess } from "@/lib/cards/public-access";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const audioTypes = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "sample" || !isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "样片不支持真实素材上传" }, { status: 400 });
  }
  try {
    const access = await requirePublicCardAccess(request, slug);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("没有收到文件");
    const type = imageTypes.has(file.type)
      ? "image"
      : audioTypes.has(file.type)
        ? "audio"
        : null;
    if (!type) return NextResponse.json({ error: "只支持照片或音频" }, { status: 415 });
    const maxBytes = type === "image" ? 6 * 1024 * 1024 : 12 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: type === "image" ? "照片不能超过6MB" : "音频不能超过12MB" },
        { status: 413 },
      );
    }
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${access.card.owner_id}/${access.card.id}/${randomUUID()}.${ext}`;
    const { error } = await access.admin.storage
      .from("recipient-media")
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (error) throw error;
    const { data, error: signError } = await access.admin.storage
      .from("recipient-media")
      .createSignedUrl(path, 60 * 60);
    if (signError) throw signError;
    return NextResponse.json({
      asset: { type, path, url: data.signedUrl, name: file.name.slice(0, 160) },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "上传失败" },
      { status: 400 },
    );
  }
}
