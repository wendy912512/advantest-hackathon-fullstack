"use client";

import { useEffect, useState } from "react";
import type { AlertSource, UnifiedAlert } from "@/lib/alerts";
import { C, MONO } from "@/lib/theme";
import { formatPid, VERDICT_LABELS } from "@/lib/thermal";
import { IconAlertTriangle, IconCircleX, IconTemperature } from "@tabler/icons-react";

type NotifFilter = "all" | "critical" | "warning";

const SOURCE_LABELS: Record<AlertSource, string> = {
  trend: "趨勢異常",
  thermal: "溫度預測",
  failure: "測試失敗",
};

function AlertCard({ alert, isLatest, flash }: { alert: UnifiedAlert; isLatest: boolean; flash: boolean }) {
  const t = alert.thermal;
  const isCritical = alert.severity === "critical";
  // 溫度卡是「模型預測通知」而非已發生的 Critical/Warning 事故，因此以
  // 藍色溫度圖示建立資訊層級；上限風險只用右側文字標籤提示。
  const sevColor = t ? C.blue : isCritical ? C.red : "#E65100";
  const sevBg = t ? C.blueBg : isCritical ? C.redBg : "#FFF3E0";
  const sevBorder = t ? "#B8CDF5" : isCritical ? C.redBorder : "#FFCCAA";
  const verified = t?.verdict != null;
  const sevLabel = t ? (verified ? "預測結果已驗證" : "溫度預測提醒") : isCritical ? "Critical" : "Warning";
  const isMiss = t?.verdict === "miss";
  const isOverLimitPrediction = t?.status === "critical";
  const riskLabel = isMiss ? "實測超出規格（漏報）" : isOverLimitPrediction ? "預測超過上限" : "預測接近上限";
  const riskColor = isMiss || isOverLimitPrediction ? C.red : "#B45309";
  const riskBg = isMiss || isOverLimitPrediction ? C.redBg : "#FFF3E0";

  return (
    <div
      style={{
        background: isLatest && flash ? sevBg : C.card,
        borderRadius: 12,
        border: `1px solid ${isLatest ? sevBorder : C.border}`,
        padding: "14px 16px",
        marginBottom: 10,
        boxShadow: isLatest ? `${C.shadowMd}, 0 0 0 1px ${sevBorder}` : C.shadow,
        transition: "background 0.5s, border-color 0.3s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: sevBg, border: `2px solid ${sevBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {t ? <IconTemperature size={18} stroke={2} color={C.blue} /> : isCritical ? <IconCircleX size={17} stroke={2} color={sevColor} /> : <IconAlertTriangle size={17} stroke={2} color={sevColor} />}
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: sevColor }}>{sevLabel}</span>
          {t ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: riskColor, background: riskBg, borderRadius: 100, padding: "2px 8px" }}>
              {riskLabel}
            </span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 500, color: C.muted, background: C.surfaceVariant, borderRadius: 100, padding: "2px 8px" }}>
              {SOURCE_LABELS[alert.source]}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: t ? "repeat(4, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 10 }}>
        <LocationField label="LOT" value={alert.lot} />
        <LocationField label="WAFER" value={alert.wafer} />
        {t && <LocationField label="DEVICE" value={formatPid(t.pid)} />}
        {alert.site > 0 && <LocationField label="SITE" value={String(alert.site)} />}
      </div>

      {t ? (
        <div style={{ background: C.surfaceVariant, borderRadius: 8, padding: "10px 12px", marginBottom: 10, fontSize: 13, color: C.sub, lineHeight: 1.8 }}>
          <div>
            預測項目：<span style={{ fontFamily: MONO, fontWeight: 600 }}>{t.sensorName}</span>
          </div>
          <div>
            預測溫度：<span style={{ fontFamily: MONO, fontWeight: 600, color: sevColor }}>{t.predicted.toFixed(2)}{t.unit}</span>
            {t.verdict === null && <span style={{ color: C.muted }}>（尚待實測確認）</span>}
          </div>
          <div>
            規格上限：<span style={{ fontFamily: MONO, fontWeight: 600 }}>{t.upperLimit}{t.unit}</span>
          </div>
          <div>
            預測時間：<span style={{ fontFamily: MONO }}>{new Date(alert.detectedAt).toLocaleTimeString("en-GB")}</span>
          </div>
          {t.verdict != null && t.actual !== null && t.error !== null && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
              <div>
                預測值：<span style={{ fontFamily: MONO }}>{t.predicted.toFixed(2)}{t.unit}</span>
              </div>
              <div>
                實際值：<span style={{ fontFamily: MONO }}>{t.actual.toFixed(2)}{t.unit}</span>
              </div>
              <div>
                誤差：<span style={{ fontFamily: MONO }}>{t.error > 0 ? "+" : ""}{t.error.toFixed(2)}{t.unit}</span>
              </div>
              <div>
                結果：<span style={{ fontWeight: 700, color: t.verdict === "hit" ? C.green : t.verdict === "ok" ? C.muted : C.red }}>{VERDICT_LABELS[t.verdict]}</span>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {!t && (
        <>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: C.muted }}>測試項目：</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.sub, fontFamily: MONO }}>{alert.testItem}</span>
          </div>

          <div style={{ background: C.surfaceVariant, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", marginBottom: 5 }}>判定原因</div>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{alert.message}</div>
          </div>
        </>
      )}

    </div>
  );
}

function LocationField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0, padding: "6px 8px", borderRadius: 7, background: C.surfaceVariant }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: "0.08em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

// 這個面板不論目前在哪一頁都固定顯示在右側（見 AppChrome.tsx），資料來自
// AppDataProvider 彙整的全系統警告（見 lib/alerts.ts 的 buildUnifiedAlerts），
// 跟各頁面自己選的歷史 lot/wafer 篩選器完全無關——只要系統有異常就要出現。
export function AlertPanel({ alerts, tick }: { alerts: UnifiedAlert[]; tick: number }) {
  const [filter, setFilter] = useState<NotifFilter>("all");
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 收到新 tick 短暫亮起最新卡片，是刻意的動畫效果
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 800);
    return () => clearTimeout(t);
  }, [tick]);

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);
  const critCount = alerts.filter((a) => a.severity === "critical").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 2 }}>CP 即時通知</div>
            <div style={{ fontSize: 12, color: C.muted }}>{alerts.length} 筆異常事件</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: C.red, display: "block" }} />
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, background: C.red, color: "#fff", padding: "3px 10px", borderRadius: 100 }}>{critCount}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, padding: 4, background: C.surfaceVariant, borderRadius: 10 }}>
          {(["all", "critical", "warning"] as const).map((f) => {
            const labels: Record<NotifFilter, string> = { all: "全部", critical: "嚴重", warning: "警告" };
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  flex: 1,
                  padding: "6px 4px",
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  background: active ? C.card : "transparent",
                  color: active ? C.text : C.muted,
                  boxShadow: active ? C.shadow : "none",
                  transition: "all 0.15s",
                }}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: C.muted, fontSize: 14 }}>無此類別通知</div>
        ) : (
          filtered.map((alert, i) => <AlertCard key={alert.id} alert={alert} isLatest={i === 0} flash={flash} />)
        )}
      </div>
    </div>
  );
}
