"use client";

import { useEffect, useRef, useState } from "react";
import { useTemperatureSnapshot } from "@/hooks/useTemperatureSnapshot";
import { useDashboardSnapshot } from "@/hooks/useDashboardSnapshot";
import { AppShell } from "@/components/common/AppShell";
import { SectionHeader } from "@/components/common/SectionHeader";
import { ThermalCard } from "@/components/temperature/ThermalCard";
import { NotificationLog } from "@/components/temperature/NotificationLog";
import { C, MONO } from "@/lib/theme";

export default function TemperaturePage() {
  const { snapshot, isLoading } = useTemperatureSnapshot();
  const { snapshot: dashboard } = useDashboardSnapshot();

  const [tick, setTick] = useState(0);
  const prevGeneratedAt = useRef<string | null>(null);

  useEffect(() => {
    if (snapshot && snapshot.generatedAt !== prevGeneratedAt.current) {
      prevGeneratedAt.current = snapshot.generatedAt;
      setTick((t) => t + 1);
    }
  }, [snapshot]);

  if (isLoading || !snapshot || !dashboard) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: C.muted, fontSize: 14 }}>載入溫度預測資料中…</span>
      </div>
    );
  }

  const overCount = snapshot.predictions.filter((p) => p.predictedTempC >= p.thresholdC).length;
  const maxTemp = snapshot.predictions.length ? Math.max(...snapshot.predictions.map((p) => p.predictedTempC)) : 0;
  const avgTemp = snapshot.predictions.length ? snapshot.predictions.reduce((a, p) => a + p.predictedTempC, 0) / snapshot.predictions.length : 0;
  const threshold = snapshot.predictions[0]?.thresholdC ?? 90;

  return (
    <AppShell
      sites={dashboard.siteSummaries}
      tick={tick}
      lastUpdate={new Date(snapshot.generatedAt).toLocaleTimeString("en-GB")}
      lot={dashboard.currentLot}
      wafer={dashboard.currentWafer}
      activeSection="s5"
    >
      <div style={{ marginBottom: 40 }}>
        <SectionHeader id="s5" label="IC Thermal Prediction — All Sites" count={snapshot.predictions.length} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
          {snapshot.predictions.map((p) => (
            <ThermalCard key={p.site} prediction={p} />
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {[
            { label: "MAX TEMP", val: `${maxTemp.toFixed(1)}°C`, color: overCount > 0 ? C.red : C.text },
            { label: "AVG TEMP", val: `${avgTemp.toFixed(1)}°C`, color: C.text },
            { label: "THRESHOLD", val: `${threshold}°C`, color: C.muted },
            { label: "ALERTS SENT", val: `${snapshot.notifications.length}`, color: overCount > 0 ? C.red : C.text },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", boxShadow: C.shadow }}>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
              <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 40 }}>
        <SectionHeader id="notif" label="Machine Notification Log" count={snapshot.notifications.length} />
        <NotificationLog notifications={snapshot.notifications} />
      </div>

      {/* Thermal Model Validation Console：待做清單項目（見 docs/feature-roadmap.md），
          需要後端提供 6 個 sensor 的「預測值 vs 實際值」時間序列（GET
          /api/temperature-telemetry 之類的端點），目前無論前端 mock 或後端
          schemas 都還沒有這筆資料，所以這裡誠實顯示「尚未串接」，不虛構假圖表。 */}
      <div style={{ marginBottom: 40 }}>
        <SectionHeader id="console" label="Thermal Model Validation Console" />
        <div
          style={{
            border: `1px dashed ${C.border}`,
            borderRadius: 12,
            padding: "32px 20px",
            textAlign: "center",
            color: C.muted,
            fontSize: 13,
            background: C.card,
          }}
        >
          尚未串接：需要後端提供 6 個 sensor（sensor1#CP ~ sensor6#IO3）的「預測值 vs 實際值」時間序列端點，
          目前資料契約中還沒有這筆資料。見 <code style={{ fontFamily: MONO }}>docs/feature-roadmap.md</code> 待排入清單。
        </div>
      </div>
    </AppShell>
  );
}
