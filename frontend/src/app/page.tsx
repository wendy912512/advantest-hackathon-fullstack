"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/components/providers/AppDataProvider";
import { useFilterableLots } from "@/hooks/useFilterableLots";
import { useTrendSeries } from "@/hooks/useTrendSeries";
import type { LotSummary, WaferFails, WaferListItem, WaferMapData } from "@/lib/api";
import { fetchLotSummary, fetchWaferFails, fetchWaferMapData } from "@/lib/api";
import { C, MONO } from "@/lib/theme";
import { LotWaferFilter } from "@/components/common/LotWaferFilter";
import { SectionHeader } from "@/components/common/SectionHeader";
import { WaferMap } from "@/components/common/WaferMap";
import { SiteCard, type SiteCardData } from "@/components/dashboard/SiteCard";
import { TrendAlertRow } from "@/components/dashboard/TrendAlertRow";
import { FailEventsTable } from "@/components/dashboard/FailEventsTable";

type Tab = "table" | "wafer" | "trend";

export default function SitesPage() {
  const { dashboard, lots: rawLots } = useAppData();
  const { series: trendSeries } = useTrendSeries();
  const lots = useFilterableLots(rawLots, dashboard);

  const [selectedLot, setSelectedLot] = useState(dashboard?.currentLot ?? "");
  const [selectedWafer, setSelectedWafer] = useState(dashboard?.currentWafer ?? "");
  const [lotSummary, setLotSummary] = useState<LotSummary | undefined>(undefined);
  const [waferMap, setWaferMap] = useState<WaferMapData | undefined>(undefined);
  const [selectedSite, setSelectedSite] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("table");
  const [waferFails, setWaferFails] = useState<WaferFails | undefined>(undefined);

  // 只要 dashboard 還沒載入完成，第一次 render 時 selectedLot/selectedWafer
  // 會是空字串；資料到位後補上預設值（目前即時監控的 lot/wafer）。
  useEffect(() => {
    if (dashboard && !selectedLot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 資料到位後補上初始篩選值，屬於一次性初始化
      setSelectedLot(dashboard.currentLot);
      setSelectedWafer(dashboard.currentWafer);
    }
  }, [dashboard, selectedLot]);

  const isLiveLot = dashboard != null && selectedLot === dashboard.currentLot;

  // 取得選定 Lot 底下的完整 wafer 清單。CSV mock 會一次載入 W01~W25，
  // 即時 Lot 也可能同時包含多片 wafer，不能只顯示目前最後載入的那一片。
  useEffect(() => {
    if (!selectedLot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 沒有選定 Lot 時清掉舊資料
      setLotSummary(undefined);
      return;
    }
    let cancelled = false;
      fetchLotSummary(selectedLot).then((data) => {
      if (!cancelled) {
        setLotSummary(data);
        setSelectedWafer((current) => data?.wafers.some((item) => item.wafer === current) ? current : data?.wafers[0]?.wafer ?? "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedLot, isLiveLot]);

  // 不論是即時監控還是歷史批次，底下的圓形 wafer map 都需要這份資料；歷史
  // 批次還需要靠它算出各 site 的 pass rate（沒有存原始量測值，只能算
  // pass/fail）。
  useEffect(() => {
    if (!selectedLot || !selectedWafer) return;
    let cancelled = false;
    fetchWaferMapData(selectedLot, selectedWafer).then((data) => {
      if (!cancelled) setWaferMap(data);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedLot, selectedWafer]);

  // 換了 lot/wafer 之後，原本選的 site 已經沒有意義，要求使用者重新選一次。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 篩選條件變了，下面的 site 選取狀態本來就要跟著重置
    // 預設選第一個 Site，讓 Table 一進頁面就有明確的上下文。
    setSelectedSite(1);
  }, [selectedLot, selectedWafer]);

  const isLiveWafer = isLiveLot && dashboard != null && selectedWafer === dashboard.currentWafer;

  // Table 分頁只呈現 Fail 異常資料：整片 wafer 抓一次，再依選的 Site 過濾。
  useEffect(() => {
    if (!selectedLot || !selectedWafer) return;
    let cancelled = false;
    fetchWaferFails(selectedLot, selectedWafer).then((data) => {
      if (!cancelled) setWaferFails(data);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedLot, selectedWafer]);

  if (!dashboard) return null;

  const siteCards: SiteCardData[] = isLiveWafer
    ? dashboard.siteSummaries
    : buildHistoricalSiteCards(waferMap);

  const waferOptions: WaferListItem[] = lotSummary?.wafers?.length
    ? lotSummary.wafers
    : [{ wafer: dashboard.currentWafer, totalDevices: dashboard.totalDevicesTested, passRate: dashboard.overallPassRate, hasIssue: false }];

  const selectedSeries = trendSeries?.find((s) => s.site === selectedSite);

  const failRows = (waferFails?.rows ?? []).filter((r) => r.site === selectedSite);

  const waferPassRatePct = isLiveWafer
    ? dashboard.overallPassRate * 100
    : (lotSummary?.wafers.find((w) => w.wafer === selectedWafer)?.passRate ?? 0) * 100;

  return (
    <div>
      <LotWaferFilter
        lots={lots}
        selectedLot={selectedLot}
        onSelectLot={setSelectedLot}
        wafers={waferOptions}
        selectedWafer={selectedWafer}
        onSelectWafer={setSelectedWafer}
      />

      <div style={{ marginBottom: 32 }}>
        <SectionHeader id="site-status" label={`Site Status — ${selectedLot} / ${selectedWafer}`} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {siteCards.map((s) => (
            <SiteCard key={s.site} site={s} selected={selectedSite === s.site} onClick={() => setSelectedSite(selectedSite === s.site ? null : s.site)} />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", gap: 4, padding: 4, background: C.surfaceVariant, borderRadius: 10, width: "fit-content", marginBottom: 16 }}>
          {(["table", "wafer", "trend"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 20px",
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: tab === t ? 600 : 400,
                background: tab === t ? C.card : "transparent",
                color: tab === t ? C.text : C.muted,
                boxShadow: tab === t ? C.shadow : "none",
              }}
            >
              {t === "table" ? "Table" : t === "wafer" ? "Wafer Map" : "Trend Alert"}
            </button>
          ))}
        </div>

        {tab === "wafer" ? (
          waferMap ? (
            <div>
              <SectionHeader id="wafer-map" label="Wafer Map" />
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, background: C.card, boxShadow: C.shadow }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: "0.06em", marginBottom: 4 }}>LOT ID</div>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C.text }}>{selectedLot}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: "0.06em", marginBottom: 4 }}>WAFER</div>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C.text }}>{selectedWafer}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: "0.06em", marginBottom: 4 }}>PASS RATE</div>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: waferPassRatePct >= 80 ? C.green : C.red }}>{waferPassRatePct.toFixed(1)}%</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <WaferMap data={waferMap} />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 16px", color: C.muted, fontSize: 14, border: `1px dashed ${C.border}`, borderRadius: 12, background: C.card }}>
              載入 Wafer Map 資料中…
            </div>
          )
        ) : selectedSite == null ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: C.muted, fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 12, background: C.card }}>
            請先在上方選擇一個 Site
          </div>
        ) : tab === "trend" ? (
          isLiveWafer ? (
            selectedSeries && selectedSeries.alerts.length > 0 ? (
              <TrendAlertRow series={selectedSeries} />
            ) : (
              <div style={{ textAlign: "center", padding: "32px 16px", color: C.muted, fontSize: 14, border: `1px dashed ${C.border}`, borderRadius: 12, background: C.card }}>
                目前沒有趨勢異常，不顯示正常趨勢。
              </div>
            )
          ) : (
            <div style={{ textAlign: "center", padding: "32px 16px", color: C.muted, fontSize: 14, border: `1px dashed ${C.border}`, borderRadius: 12, background: C.card }}>
              歷史批次目前沒有趨勢分析，這個功能只在即時監控時提供。
            </div>
          )
        ) : (
          <FailEventsTable key={`${selectedLot}/${selectedWafer}/${selectedSite}`} rows={failRows} title={`Fail 異常資料 — Site ${selectedSite}`} />
        )}
      </div>

    </div>
  );
}

function buildHistoricalSiteCards(waferMap: WaferMapData | undefined): SiteCardData[] {
  if (!waferMap) return [];
  const bySite = new Map<number, { pass: number; fail: number; total: number }>();
  for (const p of waferMap.points) {
    const entry = bySite.get(p.site) ?? { pass: 0, fail: 0, total: 0 };
    entry.total += 1;
    if (p.pf === "PASS") entry.pass += 1;
    else entry.fail += 1;
    bySite.set(p.site, entry);
  }
  return Array.from(bySite.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([site, { pass, total, fail }]) => ({ site, passRate: total ? pass / total : 0, count: total, failDeviceCount: fail }));
}
