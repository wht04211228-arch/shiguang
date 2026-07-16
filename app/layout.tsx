import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "拾光｜私人数字纪念礼物", template: "%s｜拾光" },
  description: "为重要的人，制作一份可以被打开、聆听和回应的私人数字纪念礼物。",
  icons: { icon: "/brand/shiguang-icon.svg" },
  openGraph: {
    title: "拾光｜把普通却珍贵的日子，重新装订成一份礼物",
    description: "AI 故事助手、三种视觉叙事主题、互动样片与长期纪念空间。",
    type: "website",
    locale: "zh_CN",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F8F1E9" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
