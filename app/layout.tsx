import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "拾光｜多人共创互动式数字纪念礼物",
    template: "%s｜拾光",
  },
  description:
    "把照片、声音、真实回忆和多人祝福，制作成一份可以打开、互动、回应、继续补写并长期保存的数字礼物。",
  icons: { icon: "/brand/shiguang-icon.svg" },
  openGraph: {
    title: "拾光｜把共同经历过的时间，重新送给重要的人一次",
    description: "私人数字纪念礼物、多人秘密共创与长期纪念空间。",
    type: "website",
    locale: "zh_CN",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F1E7",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
