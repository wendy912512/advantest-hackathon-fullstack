import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppDataProvider } from "@/components/providers/AppDataProvider";
import { AppChrome } from "@/components/common/AppChrome";

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

// 版面骨架（Header/Sidebar/底部導覽/右側警告欄）統一在這裡組裝一次
// （AppChrome），資料統一從 AppDataProvider 拿。這樣右側警告欄才能真的做到
// 「不論頁面如何切換都保持固定」——之前是每個 page.tsx 各自 fetch 一份
// 資料、各自組一次版面，切頁時警告欄會被卸載重掛。/about 頁是唯一的例外
// （純文件頁，見該檔案開頭註解），沒有套用這層 chrome。
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppDataProvider>
          <AppChrome>{children}</AppChrome>
        </AppDataProvider>
      </body>
    </html>
  );
}
