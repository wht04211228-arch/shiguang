import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findInviteByToken, hashCollaborationToken, isInviteAccepting } from "@/lib/collaboration/server";
import { collaborationVideoLimit } from "@/lib/collaboration/types";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const audioTypes = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg"]);
const videoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const result = await findInviteByToken(token);
    if (!result) return NextResponse.json({ error: "邀请链接不存在" }, { status: 404 });
    const { invite, space } = result;
    const acceptance = isInviteAccepting({ space, invite });
    if (!acceptance.allowed) {
      return NextResponse.json({ error: acceptance.reason }, { status: 403 });
    }
    const form = await request.formData();
    const file = form.get("file");
    const durationSeconds = Number(form.get("durationSeconds") || 0);
    if (!(file instanceof File)) throw new Error("没有收到文件");

    let type: "image" | "audio" | "video";
    let maxBytes: number;
    if (imageTypes.has(file.type)) {
      type = "image";
      maxBytes = 6 * 1024 * 1024;
    } else if (audioTypes.has(file.type)) {
      type = "audio";
      maxBytes = 12 * 1024 * 1024;
    } else if (videoTypes.has(file.type)) {
      type = "video";
      maxBytes = 50 * 1024 * 1024;
    } else {
      return NextResponse.json({ error: "暂不支持这种文件格式" }, { status: 415 });
    }
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `${type === "video" ? "视频" : "文件"}体积超过当前限制` },
        { status: 413 },
      );
    }

    const admin = createAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("plan_id")
      .eq("id", space.order_id)
      .maybeSingle();
    if (!order) throw new Error("订单不存在");
    const videoLimit = collaborationVideoLimit(order.plan_id);
    if (type === "video") {
      if (!videoLimit.count) {
        return NextResponse.json({ error: "当前套餐不支持视频投稿" }, { status: 402 });
      }
      if (!durationSeconds || durationSeconds > videoLimit.seconds + 0.5) {
        return NextResponse.json(
          { error: `当前套餐每段视频最长 ${videoLimit.seconds} 秒` },
          { status: 413 },
        );
      }
    }

    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const tokenFolder = hashCollaborationToken(token).slice(0, 16);
    const path = `${space.owner_id}/${space.id}/${tokenFolder}/${randomUUID()}.${ext}`;
    const { error } = await admin.storage
      .from("collaboration-media")
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (error) throw error;
    const { data: signed, error: signError } = await admin.storage
      .from("collaboration-media")
      .createSignedUrl(path, 60 * 60);
    if (signError) throw signError;
    return NextResponse.json({
      asset: {
        type,
        path,
        url: signed.signedUrl,
        name: file.name.slice(0, 160),
        durationSeconds: type === "video" ? durationSeconds : undefined,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "上传失败" },
      { status: 400 },
    );
  }
}
