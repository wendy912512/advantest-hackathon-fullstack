"use client";

import { useState } from "react";
import type { DeviceSensorPrediction, DeviceThermal, ThermalSensorMeta, ThermalStatus, WaferThermal } from "@/lib/api";
import { C, MONO } from "@/lib/theme";
import { SectionHeader } from "@/components/common/SectionHeader";
import { formatPid, STATUS_COLORS, STATUS_LABELS, VERDICT_LABELS } from "@/lib/thermal";


const STAGE_LABELS = { verified: "已實測", next: "預測中", future: "未到" } as const;

function predictionOf(device: DeviceThermal, sensor: number): DeviceSensorPrediction | undefined {
  return device.sensors.find((s) => s.sensor === sensor);
}

function SummaryStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", boxShadow: C.shadow }}>
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: color ?? C.text }}>{value}</div>
    </div>
  );
}

// 「先預測、再驗證」的 wafer 檢視：預測摘要 → 80 個 device 的預測狀態矩陣 →
// 點某個 device 看預測值/上限/實測/誤差/判定。不是等整片測完才分析。
export function WaferThermalView({ data }: { data: WaferThermal }) {
  const defaultSensor =
    data.nextSensor ??
    data.sensors.reduce((best, s) => {
      const alarms = (x: ThermalSensorMeta) =>
        data.devices.filter((d) => {
          const p = predictionOf(d, x.index);
          return p && (p.status === "warning" || p.status === "critical");
        }).length;
      return alarms(s) > alarms(best) ? s : best;
    }, data.sensors[0]).index;

  const [sensorIndex, setSensorIndex] = useState<number>(defaultSensor);
  // hover（或鍵盤 focus）時在該格旁邊浮出詳細卡片（位置由格子的 offset 算出，卡片本身
  // 不接收滑鼠事件，避免游標移進卡片造成閃爍）。
  const [hover, setHover] = useState<{ pid: string; left: number; top: number; height: number; above: boolean } | null>(null);

  const sensor = data.sensors.find((s) => s.index === sensorIndex) ?? data.sensors[0];
  const preds = data.devices.map((d) => ({ device: d, p: predictionOf(d, sensor.index) }));

  const count = (status: string) => preds.filter((x) => x.p?.status === status).length;
  const predicted = preds.filter((x) => x.p && x.p.predicted !== null).length;
  const awaiting = preds.filter((x) => x.p && x.p.predicted !== null && x.p.actual === null).length;
  const verdictCount = (v: string) => preds.filter((x) => x.p?.verdict === v).length;
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
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {data.sensors.map((s) => {
          const active = s.index === sensor.index;
          return (
            <button
              key={s.index}
              onClick={() => setSensorIndex(s.index)}
              disabled={s.stage === "future"}
              title={s.stage === "future" ? "還沒輪到這個 sensor，不預測" : s.name}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: `1px solid ${active ? C.blue : C.border}`,
                background: active ? C.blueBg : C.card,
                color: s.stage === "future" ? C.dim : active ? C.blue : C.sub,
                cursor: s.stage === "future" ? "not-allowed" : "pointer",
                fontFamily: MONO,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                textAlign: "left",
              }}
            >
              <div>{s.name.replace(/^\d+_Main\./, "")}</div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>{STAGE_LABELS[s.stage]}</div>
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 32 }}>
        <SectionHeader id="thermal-summary" label={`Wafer ${data.wafer} 預測摘要 — ${sensor.name}`} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <SummaryStat label="預測中的 DEVICE" value={`${predicted} 個`} />
          <SummaryStat label="預測正常" value={`${count("normal")} 個`} color={C.green} />
          <SummaryStat label="預測 WARNING" value={`${count("warning")} 個`} color={C.yellow} />
          <SummaryStat label="預測 CRITICAL" value={`${count("critical")} 個`} color={C.red} />
          <SummaryStat label="待實際驗證" value={`${awaiting} 個`} color={C.muted} />
        </div>
        {sensor.stage === "verified" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
            <SummaryStat label="預測成功" value={`${verdictCount("hit")} 個`} color={C.green} />
            <SummaryStat label="誤報" value={`${verdictCount("false_alarm")} 個`} color={C.yellow} />
            <SummaryStat label="漏報" value={`${verdictCount("miss")} 個`} color={C.red} />
            <SummaryStat label="平均絕對誤差" value={mae === null ? "—" : `${mae.toFixed(2)}${sensor.unit}`} />
          </div>
        )}
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>
          規格上限 {sensor.upperLimit ?? "—"}
          {sensor.unit}，預測 ≥ {sensor.warnThreshold?.toFixed(2) ?? "—"}
          {sensor.unit} 為 Warning、≥ 上限為 Critical（Warning 區間為暫定值，需與工程師確認）。
          {sensor.stage === "next" && " 這個 sensor 正在預測中、尚未實測，所以只寫「預測會超標」，不是「已超標」。"}
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <SectionHeader id="thermal-matrix" label="Device 預測狀態矩陣" count={data.devices.length} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {(["normal", "warning", "critical", "pending"] as const).map((st) => (
            <span key={st} className="md-chip">
              <span className="md-chip-icon" style={{ color: STATUS_COLORS[st].fg }}>
                <StatusIcon status={st} />
              </span>
              {st === "normal" ? "預測溫度正常" : st === "warning" ? "預測接近上限" : st === "critical" ? "預測會超過上限" : "尚未收到足夠資料"}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 12, color: C.muted }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, background: C.surfaceVariant, flexShrink: 0 }} />
          灰色磚 = 已有預測、尚未取得實際數據（待驗證），圖示顏色為預測狀態；實測回來後整塊改為該狀態的底色
        </div>
        <div style={{ position: "relative" }} onMouseLeave={() => setHover(null)}>
        <div className="md-matrix">
          {preds.map(({ device, p }) => {
            const st = p?.status ?? "pending";
            const colors = STATUS_COLORS[st];
            // 已有預測、但實測還沒回來（待實際驗證）→ 灰底；預測狀態改用邊框與符號的
            // 顏色表示，實測回來後才換成該狀態的底色。
            const awaitingActual = p != null && p.predicted !== null && p.actual === null;
            return (
              <button
                key={device.pid}
                type="button"
                className="md-tile"
                aria-label={`${formatPid(device.pid)}，${STATUS_LABELS[st]}`}
                onMouseEnter={(e) => showHover(e.currentTarget, device.pid)}
                onFocus={(e) => showHover(e.currentTarget, device.pid)}
                onBlur={() => setHover(null)}
                style={{
                  // MD3 tonal tile：無粗邊框，用容器色表達狀態；待驗證（已預測、實測未回）
                  // 用灰色容器，預測狀態由左上角的圖示表達。
                  background: awaitingActual ? C.surfaceVariant : colors.bg,
                  color: C.text,
                }}
              >
                <span className="md-tile-icon" style={{ background: awaitingActual ? colors.bg : "rgba(255,255,255,0.65)", color: colors.fg }}>
                  <StatusIcon status={st} />
                </span>
                <span className="md-tile-label">{formatPid(device.pid)}</span>
                <span className="md-tile-value" style={{ color: C.sub }}>
                  {p?.predicted != null ? `${p.predicted.toFixed(2)}°` : "—"}
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
  const colors = STATUS_COLORS[p.status];
  const rows: [string, string, string?][] = [
    ["預測", p.predicted === null ? "—" : `${p.predicted.toFixed(2)}${unit}`],
    ["上限", upper === null ? "—" : `${upper}${unit}`],
    ["狀態", STATUS_LABELS[p.status], colors.fg],
    ["實際", p.actual === null ? "待實測" : `${p.actual.toFixed(2)}${unit}`],
    ["誤差", p.error === null ? "—" : `${p.error > 0 ? "+" : ""}${p.error.toFixed(2)}${unit}`],
    ["結果", p.verdict ? VERDICT_LABELS[p.verdict] : "待驗證", p.verdict === "hit" ? C.green : p.verdict === "miss" || p.verdict === "false_alarm" ? C.red : undefined],
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
        border: `1px solid ${colors.border}`,
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

// Material Symbols（filled）：check_circle / warning / error / schedule
const ICON_PATHS = {
  normal: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  warning: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  critical: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
  pending: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z",
} as const;

function StatusIcon({ status }: { status: ThermalStatus }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true">
      <path d={ICON_PATHS[status]} />
    </svg>
  );
}
