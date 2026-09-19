import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CP Monitor",
  description: "半導體測試資料即時串流與異常監控 Dashboard",
};

// 版面（Header/Sidebar/底部導覽）改由各頁面自己透過 AppShell 組裝，
// 因為 Header 需要依路由顯示不同內容（Dashboard 的 LOT/WAFER 資訊 vs
// 溫度預測頁的麵包屑），不適合放在共用的 RootLayout 裡。
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
