import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ThemeStudioExperience from "@/components/theme-studio/ThemeStudioExperience";
import { isThemeKey, themeDefinitions } from "@/lib/experience/themes";

export const metadata: Metadata = { title: "主题制作台体验｜拾光" };

export default async function ThemeStudioPage({ params }: { params: Promise<{ theme: string }> }) {
  const { theme } = await params;
  if (!isThemeKey(theme)) notFound();
  return <ThemeStudioExperience initialTheme={theme} />;
}
