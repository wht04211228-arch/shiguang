import type { Metadata } from "next";
import { redirect } from "next/navigation";
import StoryPreviewGenerator from "@/components/ai/StoryPreviewGenerator";
import { isThemeKey } from "@/lib/experience/themes";

export const metadata: Metadata = { title: "AI 故事预览｜拾光" };

export default async function StoryPreviewPage({ searchParams }: { searchParams: Promise<{ theme?: string; plan?: string }> }) {
  const { theme, plan = "deep" } = await searchParams;
  if (!theme || !isThemeKey(theme)) redirect("/create");
  return <StoryPreviewGenerator theme={theme} plan={plan} />;
}
