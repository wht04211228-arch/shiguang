import type { Metadata } from "next";
import ThemeRecommendationWizard from "@/components/ai/ThemeRecommendationWizard";

export const metadata: Metadata = { title: "AI 主题推荐｜拾光故事助手" };

export default function CreatePage() {
  return <ThemeRecommendationWizard />;
}
