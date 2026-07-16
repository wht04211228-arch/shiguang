import type { Metadata } from "next";
import GalaxyDemo from "@/components/demo/GalaxyDemo";

export const metadata: Metadata = {
  title: "距离之外，我们仍在同一片星空｜拾光官方样片",
  description: "可解锁、可播放、可自由浏览和回复的梦幻星空互动礼物样片。",
};

export default async function GalaxyDemoPage({ searchParams }: { searchParams: Promise<{ sound?: string }> }) {
  const { sound } = await searchParams;
  return <GalaxyDemo initialSound={sound === "on"} />;
}
