import type { Metadata } from "next";
import CloudCardLoader from "@/components/CloudCardLoader";
import AnalyticsEvent from "@/components/AnalyticsEvent";
import LocalCardLoader from "@/components/LocalCardLoader";
import { sampleCard } from "@/lib/card-data";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

type CardPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: CardPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "一份只属于你的礼物｜拾光",
    description: `私人数字纪念礼物（${slug}）。`,
  };
}

export default async function CardPage({ params }: CardPageProps) {
  const { slug } = await params;
  return (
    <>
      <AnalyticsEvent name="sample_opened" metadata={{ slug }} />
      {isSupabaseAdminConfigured() ? (
        <CloudCardLoader slug={slug} />
      ) : (
        <LocalCardLoader slug={slug} fallback={{ ...sampleCard, slug }} />
      )}
    </>
  );
}
