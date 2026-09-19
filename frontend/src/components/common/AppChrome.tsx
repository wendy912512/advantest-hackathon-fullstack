"use client";

import type { ReactNode } from "react";
import { useAppData } from "@/components/providers/AppDataProvider";
import { buildUnifiedAlerts } from "@/lib/alerts";
import { C } from "@/lib/theme";
import { Header } from "./Header";
import { Sidebar, MobileBottomNav } from "./Nav";
import { AlertPanel } from "./AlertPanel";

// 這是「不論切到哪一頁都固定顯示」的整體版面骨架：Header、左側/底部導覽、
// 右側警告欄都在這裡組裝一次，{children} 是各頁面自己的內容。之前是每個
// page.tsx 各自包一層 AppShell、各自 fetch 資料，導致警告欄跟著頁面切換
// 被卸載重掛；現在資料統一從 AppDataProvider 拿，警告欄在這裡掛一次就好。
export function AppChrome({ children }: { children: ReactNode }) {
  const { dashboard, liveThermal, failures, tick, lastUpdate, isLoading } = useAppData();

  if (isLoading || !dashboard) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: C.muted, fontSize: 14 }}>載入即時測試資料中…</span>
      </div>
    );
  }

  const alerts = buildUnifiedAlerts({ dashboard, liveThermal, failures });

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <Header sites={dashboard.siteSummaries} tick={tick} lastUpdate={lastUpdate} lot={dashboard.currentLot} wafer={dashboard.currentWafer} />
      <div className="flex" style={{ minHeight: "calc(100vh - 56px)" }}>
        <Sidebar />
        <main className="flex-1 overflow-x-hidden" style={{ padding: "20px 16px 80px", minWidth: 0 }}>
          <div className="xl:hidden" style={{ marginBottom: 20 }}>
            <AlertPanel alerts={alerts} tick={tick} />
          </div>
          {children}
        </main>
        <div
          className="hidden xl:flex flex-col"
          style={{ width: 324, flexShrink: 0, borderLeft: `1px solid ${C.border}`, position: "sticky", top: 56, height: "calc(100vh - 56px)", overflowY: "auto", padding: "16px 14px" }}
        >
          <AlertPanel alerts={alerts} tick={tick} />
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
