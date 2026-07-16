import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PlanRecommendationWizard from "@/components/ai/PlanRecommendationWizard";
import { isThemeKey } from "@/lib/experience/themes";

export const metadata: Metadata = { title: "套餐推荐｜拾光" };

export default async function PlanRecommendPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const { theme } = await searchParams;
  if (!theme || !isThemeKey(theme)) redirect("/create");
  return <PlanRecommendationWizard theme={theme} />;
}
