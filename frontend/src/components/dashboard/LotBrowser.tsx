"use client";

import { useEffect, useState } from "react";
import type { LotSummary, WaferListItem, WaferMapData } from "@/lib/api";
import { fetchLotSummary, fetchWaferMapData } from "@/lib/api";
import { C, MONO } from "@/lib/theme";
import { BIN_COLORS } from "@/lib/binLabels";
import { WaferMap } from "@/components/common/WaferMap";

function WaferThumb({ wafer, active, onClick }: { wafer: WaferListItem; active: boolean; onClick: () => void }) {
  const pr = wafer.passRate * 100;
  const dotColor = pr >= 90 ? C.green : pr >= 80 ? "#D97706" : C.red;
  return (
    <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          border: `2px solid ${active ? dotColor : wafer.hasIssue ? C.redBorder : C.border}`,
          background: active ? `${dotColor}1A` : C.card,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: active ? C.shadowMd : "none",
          transition: "all 0.15s",
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, color: dotColor }}>{Math.round(pr)}%</span>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{wafer.wafer}</span>
    </button>
  );
}

// 這頁的目的是「比較同一個 lot 裡的多片 wafer」，lot 本身在頁面最上面用
// LotWaferFilter 下拉選（見 app/wafers/page.tsx），所以這個元件不再自己管
// 一排 lot 卡片，只吃一個 lot 字串，顯示那個 lot 的彙總 + bin pareto +
// wafer 縮圖網格 + 點下去看大圖。
export function LotBrowser({ lot }: { lot: string }) {
  const [summary, setSummary] = useState<LotSummary | undefined>(undefined);
  const [selectedWafer, setSelectedWafer] = useState<string | null>(null);
  const [waferMap, setWaferMap] = useState<WaferMapData | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchLotSummary(lot).then((data) => {
      if (!cancelled) {
        setSummary(data);
        setSelectedWafer(data?.wafers[0]?.wafer ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [lot]);

  useEffect(() => {
    if (!selectedWafer) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 取消選取時重置本地面板狀態，非 render 可推導值
      setWaferMap(undefined);
      return;
    }
    let cancelled = false;
    fetchWaferMapData(lot, selectedWafer).then((data) => {
      if (!cancelled) setWaferMap(data);
    });
    return () => {
      cancelled = true;
    };
  }, [lot, selectedWafer]);

  if (!summary) {
    return <div style={{ color: C.muted, fontSize: 14 }}>載入批次資料中…</div>;
  }

  return (
    <div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, background: C.card, marginBottom: 12, boxShadow: C.shadow }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.borderLight}` }}>
          {[
            { label: "LOT ID", val: summary.lot, color: C.text },
            { label: "PASS RATE", val: `${(summary.passRate * 100).toFixed(1)}%`, color: C.text },
            { label: "WAFERS", val: `${summary.waferCount}`, color: C.text },
            { label: "ISSUE WAFERS", val: `${summary.wafers.filter((w) => w.hasIssue).length}`, color: C.red },
          ].map(({ label, val, color }) => (
            <div key={label}>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color }}>{val}</div>
            </div>
          ))}
        </div>

        {summary.suspectIssues.length > 0 && (
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            {summary.suspectIssues.map((issue) => (
              <div key={issue} style={{ fontSize: 12, color: C.red, background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "6px 10px" }}>
                {issue}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, background: C.card, marginBottom: 12, boxShadow: C.shadow }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: "0.06em", marginBottom: 10 }}>WAFER GRID — CLICK TO INSPECT</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          {summary.wafers.map((w) => (
            <WaferThumb key={w.wafer} wafer={w} active={selectedWafer === w.wafer} onClick={() => setSelectedWafer(w.wafer)} />
          ))}
        </div>

        {waferMap && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.borderLight}` }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>WAFER</div>
              <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: C.text }}>{waferMap.wafer}</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              {[
                { label: "通過", color: BIN_COLORS[1] },
                { label: "測試失敗", color: C.red },
              ].map(({ label, color }) => (
                <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.muted }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
                  {label}
                </span>
              ))}
            </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <WaferMap data={waferMap} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
