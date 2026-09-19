"use client";

import { useEffect, useState } from "react";
import type { TrendAlert } from "@/lib/api";
import { C, MONO } from "@/lib/theme";

type NotifFilter = "all" | "critical" | "warning";

// 嚴重度純粹依 direction 分：SHIFT（含 site unbalance / 超出管制界線）視為
// critical，UP/DOWN（漂移中，尚未失控）視為 warning。這是前端顯示用的
// 簡單分級，不是後端定義的欄位——目前資料契約裡沒有嚴重度欄位。
function severityOf(alert: TrendAlert): "critical" | "warning" {
  return alert.direction === "SHIFT" ? "critical" : "warning";
}

function NotificationCard({ alert, lot, wafer, isLatest, flash }: { alert: TrendAlert; lot: string; wafer: string; isLatest: boolean; flash: boolean }) {
  const isCritical = severityOf(alert) === "critical";
  const sevColor = isCritical ? C.red : "#E65100";
  const sevBg = isCritical ? C.redBg : "#FFF3E0";
  const sevBorder = isCritical ? C.redBorder : "#FFCCAA";
  const sevLabel = isCritical ? "Critical" : "Warning";
  const sevIcon = isCritical ? "⊗" : "⚠";

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
          <span style={{ fontSize: 15, color: sevColor, fontWeight: 700 }}>{sevIcon}</span>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: sevColor }}>{sevLabel}</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.text, fontWeight: 500 }}>{lot}</span>
        <span style={{ color: C.dim, fontSize: 13 }}>›</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.text, fontWeight: 500 }}>Wafer {wafer}</span>
        <span style={{ color: C.dim, fontSize: 13 }}>›</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.text, fontWeight: 500 }}>Site {alert.site}</span>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: C.muted }}>測試項目：</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.sub, fontFamily: MONO }}>{alert.testSuiteName}</span>
      </div>

      <div style={{ background: C.surfaceVariant, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", marginBottom: 5 }}>異常原因</div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{alert.message}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>{new Date(alert.detectedAt).toLocaleTimeString("en-GB")}</span>
      </div>
    </div>
  );
}

export function NotificationPanel({ alerts, lot, wafer, tick }: { alerts: TrendAlert[]; lot: string; wafer: string; tick: number }) {
  const [filter, setFilter] = useState<NotifFilter>("all");
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    // 收到新 tick 就短暫亮起最新一筆通知卡片，是刻意的動畫效果，
    // 不是可以從 render 推導出來的值，所以這裡合理地在 effect 內同步 setState。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 800);
    return () => clearTimeout(t);
  }, [tick]);

  const filtered = filter === "all" ? alerts : alerts.filter((a) => severityOf(a) === filter);
  const critCount = alerts.filter((a) => severityOf(a) === "critical").length;

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
          filtered.map((alert, i) => <NotificationCard key={alert.id} alert={alert} lot={lot} wafer={wafer} isLatest={i === 0} flash={flash} />)
        )}
      </div>
    </div>
  );
}
