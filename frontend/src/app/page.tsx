"use client";

import { useEffect, useRef, useState } from "react";
import { useDashboardSnapshot } from "@/hooks/useDashboardSnapshot";
import { useTrendSeries } from "@/hooks/useTrendSeries";
import { useLotList } from "@/hooks/useLotList";
import { useFailureExplanations } from "@/hooks/useFailureExplanations";
import type { SiteSummary } from "@/lib/api";
import { AppShell } from "@/components/common/AppShell";
import { SectionHeader } from "@/components/common/SectionHeader";
import { SiteCard } from "@/components/dashboard/SiteCard";
import { SiteDrawer } from "@/components/dashboard/SiteDrawer";
import { TrendAlertRow } from "@/components/dashboard/TrendAlertRow";
import { LotBrowser } from "@/components/dashboard/LotBrowser";
import { FailureExplainer } from "@/components/dashboard/FailureExplainer";
import { NotificationPanel } from "@/components/dashboard/NotificationPanel";
import { C } from "@/lib/theme";

export default function DashboardPage() {
  const { snapshot, isLoading } = useDashboardSnapshot();
  const { series } = useTrendSeries();
  const { lots } = useLotList();
  const { explanations } = useFailureExplanations();

  const [tick, setTick] = useState(0);
  const [drawerSite, setDrawerSite] = useState<SiteSummary | null>(null);
  const [activeSection, setActiveSection] = useState("s1");
  const prevGeneratedAt = useRef<string | null>(null);

  // LIVE 徽章上的計數器：每次拿到新的 snapshot（generatedAt 改變）就 +1，
  // 用來讓使用者感覺到畫面確實在更新，而不是綁在某個固定 interval 上。
  useEffect(() => {
    if (snapshot && snapshot.generatedAt !== prevGeneratedAt.current) {
      prevGeneratedAt.current = snapshot.generatedAt;
      setTick((t) => t + 1);
    }
  }, [snapshot]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { threshold: 0.3 },
    );
    ["s1", "s2", "s3", "s4"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isLoading]);

  if (isLoading || !snapshot) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: C.muted, fontSize: 14 }}>載入即時測試資料中…</span>
      </div>
    );
  }

  const trendSeriesWithAlerts = (series ?? []).filter((s) => s.alerts.length > 0);

  return (
    <AppShell
      sites={snapshot.siteSummaries}
      tick={tick}
      lastUpdate={new Date(snapshot.generatedAt).toLocaleTimeString("en-GB")}
      lot={snapshot.currentLot}
      wafer={snapshot.currentWafer}
      activeSection={activeSection}
    >
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div id="s1" style={{ marginBottom: 40 }}>
            <SectionHeader id="s1" label="Site Status — IDDQ_A1" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {snapshot.siteSummaries.map((s) => (
                <SiteCard key={s.site} site={s} onClick={() => setDrawerSite(s)} />
              ))}
            </div>
          </div>

          <div id="s2" style={{ marginBottom: 40 }}>
            <SectionHeader id="s2" label="Trend Alerts" count={trendSeriesWithAlerts.length} />
            <div className="xl:hidden" style={{ marginBottom: 20 }}>
              <NotificationPanel alerts={snapshot.trendAlerts} lot={snapshot.currentLot} wafer={snapshot.currentWafer} tick={tick} />
            </div>
            {trendSeriesWithAlerts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", color: C.muted, fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 12, background: C.card }}>
                目前所有 site 都在管制界線內
              </div>
            ) : (
              trendSeriesWithAlerts.map((s) => <TrendAlertRow key={s.site} series={s} />)
            )}
          </div>

          <div id="s3" style={{ marginBottom: 40 }}>
            <SectionHeader id="s3" label="Lot / Wafer Browser" count={lots?.length} />
            {lots && lots.length > 0 ? <LotBrowser lots={lots} /> : <div style={{ color: C.muted, fontSize: 14 }}>載入批次資料中…</div>}
          </div>

          <div id="s4" style={{ marginBottom: 40 }}>
            <SectionHeader id="s4" label="Failure Explainer" count={explanations?.length} />
            <FailureExplainer failures={explanations ?? []} />
          </div>
        </div>

        <div className="hidden xl:block" style={{ width: 324, flexShrink: 0 }} />
      </div>

      <div
        className="hidden xl:flex flex-col"
        style={{ position: "fixed", top: 56, right: 0, bottom: 0, width: 324, background: C.bg, borderLeft: `1px solid ${C.border}`, overflowY: "auto", zIndex: 20, padding: "16px 14px" }}
      >
        <NotificationPanel alerts={snapshot.trendAlerts} lot={snapshot.currentLot} wafer={snapshot.currentWafer} tick={tick} />
      </div>

      <SiteDrawer site={drawerSite} allSites={snapshot.siteSummaries} onClose={() => setDrawerSite(null)} />
    </AppShell>
  );
}
