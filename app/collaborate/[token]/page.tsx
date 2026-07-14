import type { Metadata } from "next";
import CollaborationSubmitForm from "@/components/collaboration/CollaborationSubmitForm";

export const metadata: Metadata = {
  title: "秘密共创邀请｜拾光",
  description: "通过秘密邀请链接，为一位重要的人留下文字、照片、语音或视频祝福。",
  robots: { index: false, follow: false },
};

export default async function CollaboratePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CollaborationSubmitForm token={token} />;
}
