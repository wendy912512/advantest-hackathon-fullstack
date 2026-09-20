"use client";

import { useEffect, useState } from "react";
import type { DeviceSensorPrediction, DeviceThermal, WaferThermal } from "@/lib/api";
import { C, MONO } from "@/lib/theme";
import { SectionHeader } from "@/components/common/SectionHeader";
import { formatPid, VERDICT_LABELS } from "@/lib/thermal";


const STAGE_LABELS = { verified: "已實測", next: "預測中", future: "未到" } as const;

function predictionOf(device: DeviceThermal, sensor: number): DeviceSensorPrediction | undefined {
  return device.sensors.find((s) => s.sensor === sensor);
}

// 顏色只標示「預測誤差」的大小，不代表模型輸出的 Normal/Warning/Critical。
// 0.05 / 0.10 先作為畫面輔助門檻，正式上線前可依工程規格調整。
function errorColor(error: number | null): string {
  if (error === null) return C.muted;
  const magnitude = Math.abs(error);
  if (magnitude > 0.1) return C.red;
  if (magnitude > 0.05) return C.yellow;
  return C.sub;
}

function errorBackground(error: number | null): string {
  if (error === null) return C.surfaceVariant;
  const magnitude = Math.abs(error);
  if (magnitude > 0.1) return "#FFF0F0";
  if (magnitude > 0.05) return "#FFF8E6";
  return "#F0F8F1";
}

function SummaryStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 14px", boxShadow: C.shadow }}>
      <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: color ?? C.text }}>{value}</div>
    </div>
  );
}

// 「先預測、再驗證」的 wafer 檢視：預測摘要 → 80 個 device 的預測狀態矩陣 →
// 點某個 device 看預測值/上限/實測/誤差/判定。不是等整片測完才分析。
export function WaferThermalView({ data }: { data: WaferThermal }) {
  // 測試尚未完成時看下一個待測 sensor；全部完成後回到 sensor1，
  // 不用警報數量決定預設頁面，避免畫面跳到非流程中的 sensor。
  const preferredSensor = data.nextSensor ?? data.sensors[0]?.index ?? 0;
  const [sensorIndex, setSensorIndex] = useState<number>(preferredSensor);

  // 後端每 5 秒更新一次 live thermal。只有 wafer 或測試進度改變時重設，
  // 使用者手動點選其他已實測 sensor 時不會被一般輪詢覆蓋。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 換 wafer 或下一個 sensor 改變時同步預設分頁
    setSensorIndex(preferredSensor);
  }, [data.lot, data.wafer, data.nextSensor, preferredSensor]);
  // hover（或鍵盤 focus）時在該格旁邊浮出詳細卡片（位置由格子的 offset 算出，卡片本身
  // 不接收滑鼠事件，避免游標移進卡片造成閃爍）。
  const [hover, setHover] = useState<{ pid: string; left: number; top: number; height: number; above: boolean } | null>(null);

  const sensor = data.sensors.find((s) => s.index === sensorIndex) ?? data.sensors[0];
  const preds = data.devices.map((d) => ({ device: d, p: predictionOf(d, sensor.index) }));

  const predicted = preds.filter((x) => x.p && x.p.predicted !== null).length;
  const awaiting = preds.filter((x) => x.p && x.p.predicted !== null && x.p.actual === null).length;
  const errors = preds.filter((x) => x.p?.error != null).map((x) => Math.abs(x.p!.error as number));
  const mae = errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : null;

  const showHover = (el: HTMLElement, pid: string) => {
    const container = el.offsetParent as HTMLElement | null;
    const height = container?.offsetHeight ?? 0;
    setHover({ pid, left: el.offsetLeft + el.offsetWidth / 2, top: el.offsetTop, height: el.offsetHeight, above: el.offsetTop > height / 2 });
  };
  const hoverItem = hover ? preds.find((x) => x.device.pid === hover.pid) : undefined;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {data.sensors.map((s) => {
          const active = s.index === sensor.index;
          return (
            <button
              key={s.index}
              onClick={() => setSensorIndex(s.index)}
              disabled={s.stage === "future"}
              title={s.stage === "future" ? "還沒輪到這個 sensor，不預測" : s.name}
              style={{
                padding: "5px 12px",
                borderRadius: 10,
                border: `1px solid ${active ? C.blue : C.border}`,
                background: active ? C.blueBg : C.card,
                color: s.stage === "future" ? C.dim : active ? C.blue : C.sub,
                cursor: s.stage === "future" ? "not-allowed" : "pointer",
                fontFamily: MONO,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{s.name.replace(/^\d+_Main\./, "")}</span>
              <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>{STAGE_LABELS[s.stage]}</span>
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 20 }}>
        <SectionHeader id="thermal-summary" label={`Wafer ${data.wafer} 預測摘要 — ${sensor.name}`} />
        {data.model && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10, fontSize: 12 }}>
            <span style={{ padding: "5px 9px", borderRadius: 8, background: C.blueBg, color: C.blue, fontFamily: MONO, fontWeight: 700 }}>{data.model.name}</span>
            <span style={{ color: C.sub }}>{data.model.featureSchema}</span>
            <span style={{ color: C.muted }}>跨 wafer 訓練 · 目前 sensor 使用 {data.model.featureCounts[sensor.index - 1] ?? "—"} 個特徵</span>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
          <SummaryStat label="預測中的 DEVICE" value={`${predicted} 個`} />
          <SummaryStat label="已收到正式值" value={`${predicted - awaiting} 個`} />
          <SummaryStat label="待實際驗證" value={`${awaiting} 個`} color={C.muted} />
        </div>
        {sensor.stage === "verified" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 8 }}>
            <SummaryStat label="平均絕對誤差" value={mae === null ? "—" : `${mae.toFixed(2)}${sensor.unit}`} />
          </div>
        )}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
          預測值會在 sensor 實測完成後，與正式值比較並呈現差距（正式值 − 預測值）。
          {sensor.stage === "next" && " 這個 sensor 尚未實測，目前只顯示預測值，差距會在正式值回來後計算。"}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <SectionHeader id="thermal-matrix" label="Device 預測與誤差矩陣" count={data.devices.length} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <span className="md-chip">每格顯示預測值與預測誤差</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted }}>
            <span style={{ color: C.sub }}>灰 ≤0.05</span>
            <span style={{ color: C.yellow }}>橘 0.05–0.10</span>
            <span style={{ color: C.red }}>紅 &gt;0.10</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: C.surfaceVariant, flexShrink: 0 }} />
            灰底 = 已預測、正式值尚未回來
          </span>
        </div>
        <div className="md-matrix-wrap" onMouseLeave={() => setHover(null)}>
        <div className="md-matrix">
          {preds.map(({ device, p }) => {
            return (
              <button
                key={device.pid}
                type="button"
                className="md-tile"
                aria-label={`${formatPid(device.pid)}，預測值 ${p?.predicted?.toFixed(2) ?? "尚無資料"}，差距 ${p?.error?.toFixed(2) ?? "待測"}`}
                onMouseEnter={(e) => showHover(e.currentTarget, device.pid)}
                onFocus={(e) => showHover(e.currentTarget, device.pid)}
                onBlur={() => setHover(null)}
                style={{
                  background: errorBackground(p?.error ?? null),
                  color: C.text,
                }}
              >
                <span className="md-tile-text">
                  <span className="md-tile-label">{formatPid(device.pid)}</span>
                  <span className="md-tile-value" style={{ color: C.sub }}>
                    預測 {p?.predicted != null ? p.predicted.toFixed(2) : "—"}
                  </span>
                  <span className="md-tile-value" style={{ color: errorColor(p?.error ?? null) }}>
                    差距 {p?.error != null ? `${p.error > 0 ? "+" : ""}${p.error.toFixed(2)}` : "待測"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {hoverItem && hoverItem.p && hover && (
          <HoverCard
            pid={hoverItem.device.pid}
            site={hoverItem.device.site}
            p={hoverItem.p}
            unit={sensor.unit}
            upper={sensor.upperLimit}
            left={hover.left}
            top={hover.top}
            cellHeight={hover.height}
            above={hover.above}
          />
        )}
        </div>
      </div>
    </div>
  );
}

const CARD_WIDTH = 250;

function HoverCard({
  pid,
  site,
  p,
  unit,
  upper,
  left,
  top,
  cellHeight,
  above,
}: {
  pid: string;
  site: number;
  p: DeviceSensorPrediction;
  unit: string;
  upper: number | null;
  left: number;
  top: number;
  cellHeight: number;
  above: boolean;
}) {
  const rows: [string, string, string?][] = [
    ["預測值", p.predicted === null ? "—" : `${p.predicted.toFixed(2)}${unit}`],
    ["正式值", p.actual === null ? "待測" : `${p.actual.toFixed(2)}${unit}`],
    ["差距", p.error === null ? "待測" : `${p.error > 0 ? "+" : ""}${p.error.toFixed(2)}${unit}`, errorColor(p.error)],
    ["規格上限", upper === null ? "—" : `${upper}${unit}`],
    ["驗證", p.verdict ? VERDICT_LABELS[p.verdict] : "待正式值"],
  ];
  return (
    <div
      style={{
        position: "absolute",
        left: Math.max(0, left - CARD_WIDTH / 2),
        top: above ? undefined : top + cellHeight + 6,
        bottom: above ? `calc(100% - ${top}px + 6px)` : undefined,
        width: CARD_WIDTH,
        zIndex: 20,
        pointerEvents: "none",
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        boxShadow: C.shadowMd,
        padding: "12px 14px",
        fontFamily: MONO,
        fontSize: 12,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
        {formatPid(pid)} <span style={{ color: C.muted, fontWeight: 400 }}>· Site {site}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, rowGap: 3 }}>
        {rows.map(([label, value, color]) => (
          <div key={label} style={{ display: "contents" }}>
            <span style={{ color: C.muted }}>{label}</span>
            <span style={{ fontWeight: 600, color: color ?? C.text, textAlign: "right" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

