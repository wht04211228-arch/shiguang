import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { normalizeSlug } from "@/lib/card-data";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

const maxBytes = 6 * 1024 * 1024;
const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
]);

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured())
    return NextResponse.json({ error: "云端环境尚未配置" }, { status: 503 });
  const { supabase, claims } = await requireUserClaims();
  if (!claims?.sub)
    return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const slug = normalizeSlug(String(form.get("slug") || "draft"));
  const orderId = String(form.get("orderId") || "").trim();
  if (!orderId && process.env.ALLOW_UNPAID_PUBLISH !== "true") {
    return NextResponse.json(
      { error: "上传云端素材前需要已支付订单" },
      { status: 402 },
    );
  }
  if (orderId) {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError)
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    if (
      !order ||
      !["paid", "in_progress", "fulfilled"].includes(order.status)
    ) {
      return NextResponse.json(
        { error: "订单尚未支付或不属于当前账号" },
        { status: 403 },
      );
    }
  }
  if (!(file instanceof File))
    return NextResponse.json({ error: "没有收到文件" }, { status: 400 });
  if (!allowedTypes.has(file.type))
    return NextResponse.json(
      { error: "暂不支持这种文件格式" },
      { status: 415 },
    );
  if (file.size > maxBytes)
    return NextResponse.json(
      { error: "单个文件不能超过 6 MB" },
      { status: 413 },
    );

  const ext =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${claims.sub}/${slug}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("card-media")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const { data, error: signError } = await supabase.storage
    .from("card-media")
    .createSignedUrl(path, 60 * 60 * 24);
  if (signError)
    return NextResponse.json({ error: signError.message }, { status: 500 });
  return NextResponse.json({
    path,
    url: data.signedUrl,
    type: file.type.startsWith("image/") ? "image" : "audio",
  });
}
