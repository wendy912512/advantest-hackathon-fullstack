"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/components/providers/AppDataProvider";
import { useFilterableLots } from "@/hooks/useFilterableLots";
import type { LotSummary, WaferDistribution, WaferListItem } from "@/lib/api";
import { fetchLotSummary, fetchWaferDistribution } from "@/lib/api";
import { C, MONO } from "@/lib/theme";
import { LotWaferFilter } from "@/components/common/LotWaferFilter";
import { LotBrowser } from "@/components/dashboard/LotBrowser";
import { DistributionChart } from "@/components/dashboard/DistributionChart";

export default function WafersPage() {
  const { dashboard, lots: rawLots } = useAppData();
  const lots = useFilterableLots(rawLots, dashboard);
  const [selectedLot, setSelectedLot] = useState(dashboard?.currentLot ?? "");
  const [selectedWafers, setSelectedWafers] = useState<string[]>([]);
  const [lotSummary, setLotSummary] = useState<LotSummary>();
  const [distribution, setDistribution] = useState<WaferDistribution[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");

  useEffect(() => {
    if (!selectedLot) return;
    let cancelled = false;
    fetchLotSummary(selectedLot).then((data) => {
      if (cancelled) return;
      setLotSummary(data);
      setSelectedWafers((current) => {
        const available = data?.wafers.map((item) => item.wafer) ?? [];
        const kept = current.filter((wafer) => available.includes(wafer));
        return kept.length ? kept : available;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedLot]);

  useEffect(() => {
    if (!selectedLot || !selectedWafers.length) {
      // 清除 overlay 選取時，同步清掉上一輪 chart 資料，避免畫面殘留舊線。
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 選取條件變成空時要立刻清掉舊資料
      setDistribution([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      selectedWafers.map((wafer) =>
        fetchWaferDistribution(selectedLot, wafer, selectedEvent || undefined),
      ),
    ).then((items) => {
      if (cancelled) return;
      const valid = items.filter((item): item is WaferDistribution =>
        Boolean(item),
      );
      setDistribution(valid);
      if (!selectedEvent && valid[0]?.selectedEvent)
        setSelectedEvent(valid[0].selectedEvent);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedLot, selectedWafers, selectedEvent]);

  if (!dashboard || !selectedLot) return null;

  const waferOptions: WaferListItem[] = lotSummary?.wafers?.length
    ? lotSummary.wafers
    : [
        {
          wafer: dashboard.currentWafer,
          totalDevices: dashboard.totalDevicesTested,
          passRate: dashboard.overallPassRate,
          hasIssue: false,
        },
      ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            color: C.blue,
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            marginBottom: 8,
          }}
        >
          WAFER BROWSER
        </div>
        <h1
          style={{
            fontSize: 25,
            fontWeight: 650,
            letterSpacing: "-0.02em",
            margin: 0,
            color: C.text,
          }}
        >
          Wafer 品質瀏覽
        </h1>
        <p
          style={{
            color: C.muted,
            fontSize: 13,
            margin: "8px 0 0",
            maxWidth: 720,
          }}
        >
          先查看 Lot 底下各片 Wafer 的通過率與晶圓位置，再往下分析單一測試事件的量測分布。
        </p>
      </div>

      <LotWaferFilter
        lots={lots}
        selectedLot={selectedLot}
        onSelectLot={(lot) => {
          setSelectedLot(lot);
          setSelectedEvent("");
          setSelectedWafers([]);
        }}
      />

      <section style={{ marginBottom: 28 }}>
        <div style={{ color: C.muted, fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", marginBottom: 10 }}>WAFER BROWSER</div>
        <LotBrowser lot={selectedLot} />
      </section>

      <section
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          boxShadow: C.shadow,
          padding: 20,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                color: C.muted,
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.08em",
                marginBottom: 5,
              }}
            >
              EMPIRICAL CDF
            </div>
            <h2 style={{ color: C.text, fontSize: 17, margin: 0 }}>
              事件量測值分布
            </h2>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: C.muted,
              fontSize: 12,
            }}
          >
            <span>Test event</span>
            <select
              value={selectedEvent}
              onChange={(event) => setSelectedEvent(event.target.value)}
              disabled={!distribution?.[0]?.events.length}
              style={{
                width: "min(440px, 70vw)",
                maxWidth: "100%",
                padding: "9px 12px",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                background: C.surface,
                color: C.text,
                fontFamily: MONO,
                fontSize: 12,
              }}
            >
              {distribution?.[0]?.events.map((item) => (
                <option key={item.event} value={item.event}>
                  {item.event} · n={item.count}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          style={{
            borderTop: `1px solid ${C.borderLight}`,
            paddingTop: 14,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                color: C.muted,
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.08em",
              }}
            >
              WAFER OVERLAY
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: C.muted, fontSize: 12 }}>
                {selectedWafers.length} / {waferOptions.length} selected
              </span>
              <button
                onClick={() =>
                  setSelectedWafers(waferOptions.map((wafer) => wafer.wafer))
                }
                style={{
                  border: "none",
                  background: "transparent",
                  color: C.blue,
                  fontSize: 12,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                全選
              </button>
              <button
                onClick={() => {
                  setSelectedWafers([]);
                  setDistribution([]);
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  color: C.muted,
                  fontSize: 12,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                清除
              </button>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(60px, 1fr))",
              gap: 8,
              width: "100%",
            }}
          >
            {waferOptions.map((wafer) => {
              const checked = selectedWafers.includes(wafer.wafer);
              return (
                <button
                  key={wafer.wafer}
                  aria-pressed={checked}
                  onClick={() =>
                    setSelectedWafers((current) =>
                      checked
                        ? current.filter((item) => item !== wafer.wafer)
                        : [...current, wafer.wafer],
                    )
                  }
                  style={{
                    border: `1px solid ${checked ? C.blue : C.border}`,
                    borderRadius: 40,
                    background: checked ? C.blueBg : C.surface,
                    color: checked ? C.blue : C.muted,
                    padding: "5px 5px",
                    fontFamily: MONO,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  {wafer.wafer}
                </button>
              );
            })}
          </div>
        </div>
        {distribution?.length ? (
          <DistributionChart data={distribution} />
        ) : selectedWafers.length === 0 ? (
          <div
            style={{
              minHeight: 320,
              display: "grid",
              placeItems: "center",
              color: C.muted,
              fontSize: 13,
            }}
          >
            尚未選取 wafer，請按「全選」或選擇要比較的 wafer。
          </div>
        ) : (
          <div
            style={{
              minHeight: 320,
              display: "grid",
              placeItems: "center",
              color: C.muted,
              fontSize: 13,
            }}
          >
            載入 {selectedLot} 的 W01～W25 量測資料中…
          </div>
        )}
      </section>

    </div>
  );
}
