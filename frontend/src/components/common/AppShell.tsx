"use client";

import type { ReactNode } from "react";
import type { SiteSummary } from "@/lib/api";
import { C } from "@/lib/theme";
import { Header } from "./Header";
import { Sidebar, MobileBottomNav } from "./Nav";

export function AppShell({
  children,
  sites,
  tick,
  lastUpdate,
  lot,
  wafer,
  activeSection,
  live,
}: {
  children: ReactNode;
  sites: SiteSummary[];
  tick: number;
  lastUpdate: string;
  lot: string;
  wafer: string;
  activeSection: string;
  live?: boolean;
}) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <Header sites={sites} tick={tick} lastUpdate={lastUpdate} lot={lot} wafer={wafer} live={live} />
      <div className="flex" style={{ minHeight: "calc(100vh - 56px)" }}>
        <Sidebar activeSection={activeSection} />
        <main className="flex-1 overflow-x-hidden" style={{ padding: "20px 16px 80px", minWidth: 0 }}>
          {children}
        </main>
      </div>
      <MobileBottomNav activeSection={activeSection} />
    </div>
  );
}
