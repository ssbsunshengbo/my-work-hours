import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "我的工时本｜每日工时记录与月度平均",
  description: "快速记录每日上下班时间，自动计算当天和本月平均工时。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
