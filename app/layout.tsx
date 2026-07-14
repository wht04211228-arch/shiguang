import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "拾光｜私人定制互动式数字纪念礼物",
  description:
    "把照片、声音、共同回忆和没有说出口的话，制作成一份可以打开、互动、回复和长期保存的数字礼物。",
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
