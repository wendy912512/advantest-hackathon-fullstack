import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import type { TrendAlert, TrendDirection, TrendSeries } from "@/lib/api";
import { C, MONO } from "@/lib/theme";

const DIRECTION_LABELS: Record<TrendDirection, string> = {
  UP: "↑ Mean Trend Up",
  DOWN: "↓ Mean Trend Down",
  STABLE: "Stable",
  SHIFT: "⚖ Shift / Unbalance",
};

function alertColor(alert: TrendAlert) {
  if (alert.message.includes("Stdev")) return "#B45309";
  return alert.direction === "UP" || alert.direction === "DOWN" ? C.ucl : C.red;
}

function alertBg(alert: TrendAlert) {
  if (alert.message.includes("Stdev")) return C.yellowBg;
  return alert.direction === "UP" || alert.direction === "DOWN" ? "#FFF3E0" : C.redBg;
}

// 一定要宣告在元件外面：react-hooks/static-components 規則不允許在 render
// 裡面重新建立元件（每次 render 都是新的 function reference 會讓 recharts
// 的 dot 動畫/狀態被重置）。
function AnomalyDot(props: { cx?: number; cy?: number; payload?: { anomaly?: boolean } }) {
  const { cx, cy, payload } = props;
  if (!payload?.anomaly || cx === undefined || cy === undefined) return null;
  return <circle cx={cx} cy={cy} r={4} fill={C.red} stroke="#fff" strokeWidth={1.5} />;
}

export function TrendAlertRow({ series }: { series: TrendSeries }) {
  const grouped = new Map<string, { sum: number; count: number; timestamp: string }>();
  series.points.forEach((point, index) => {
    const wafer = point.wafer ?? `SEQ-${Math.floor(index / 20) + 1}`;
    const current = grouped.get(wafer) ?? { sum: 0, count: 0, timestamp: point.timestamp };
    current.sum += point.value;
    current.count += 1;
    current.timestamp = point.timestamp;
    grouped.set(wafer, current);
  });
  const chartData = Array.from(grouped.entries()).map(([wafer, group]) => {
    const value = group.sum / group.count;
    return {
      wafer,
      value,
      timestamp: group.timestamp,
      anomaly: value > series.ucl || value < series.lcl,
    };
  });
  const uniqueAlerts = series.alerts.filter((alert, index, alerts) =>
    alerts.findIndex((candidate) => candidate.message === alert.message) === index,
  );
  const badgeAlerts = uniqueAlerts.filter((alert, index, alerts) =>
    alerts.findIndex((candidate) => candidate.direction === alert.direction) === index,
  );

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 10, overflow: "hidden", boxShadow: C.shadow }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, background: C.card, borderBottom: `1px solid ${C.border}` }}>
        {series.alerts.length === 0 && (
          <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: C.greenBg, color: C.green }}>目前無告警</span>
        )}
        {badgeAlerts.map((alert) => (
          <span
            key={alert.id}
            style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: alertBg(alert), color: alertColor(alert) }}
          >
            {DIRECTION_LABELS[alert.direction]}
          </span>
        ))}
        <span style={{ fontSize: 14, fontWeight: 500, color: C.sub }}>
          Site {series.site} — {series.testSuiteName}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted, marginLeft: "auto" }}>
          {series.alerts[0] ? new Date(series.alerts[0].detectedAt).toLocaleTimeString("en-GB") : ""}
        </span>
      </div>
      <div style={{ background: C.surface, padding: "8px 16px 4px" }}>
          {uniqueAlerts.map((alert) => (
          <div key={alert.id} style={{ fontSize: 12, color: C.sub, padding: "4px 0" }}>
            {alert.message}
          </div>
        ))}
      </div>
      <div style={{ background: C.surface, padding: "4px 16px 12px" }}>
        <div style={{ display: "flex", gap: 20, marginBottom: 8, fontFamily: MONO, fontSize: 13, flexWrap: "wrap" }}>
          <span style={{ color: C.muted }}>
            Mean: <span style={{ color: C.text, fontWeight: 600 }}>{series.baselineMean.toFixed(3)}</span>
          </span>
          <span style={{ color: C.muted }}>
            UCL: <span style={{ color: C.ucl, fontWeight: 600 }}>{series.ucl.toFixed(3)}</span>
          </span>
          <span style={{ color: C.muted }}>
            LCL: <span style={{ color: C.lcl, fontWeight: 600 }}>{series.lcl.toFixed(3)}</span>
          </span>
          <span style={{ color: C.muted, fontFamily: "inherit" }}>
            每片 wafer 平均 {chartData.length} 點
          </span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 8, right: 20, bottom: 0, left: 32 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
            <XAxis dataKey="wafer" interval={2} tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={30} />
            <Tooltip
              contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, boxShadow: C.shadowMd }}
              itemStyle={{ color: C.text }}
              labelStyle={{ color: C.muted }}
              labelFormatter={(label) => `Wafer ${label}`}
            />
            <ReferenceLine y={series.ucl} stroke={C.ucl} strokeDasharray="4 2" strokeWidth={1} label={{ value: "UCL", position: "right", fontSize: 10, fill: C.ucl }} />
            <ReferenceLine y={series.lcl} stroke={C.lcl} strokeDasharray="4 2" strokeWidth={1} label={{ value: "LCL", position: "right", fontSize: 10, fill: C.lcl }} />
            <ReferenceLine y={series.baselineMean} stroke={C.dim} strokeDasharray="2 2" strokeWidth={1} />
            <Line type="monotone" dataKey="value" stroke={C.red} strokeWidth={1.5} dot={<AnomalyDot />} activeDot={{ r: 3, fill: C.red }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
