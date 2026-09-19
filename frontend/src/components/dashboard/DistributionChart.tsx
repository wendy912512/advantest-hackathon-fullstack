import type { WaferDistribution } from "@/lib/api";
import { C, MONO } from "@/lib/theme";

export function DistributionChart({ data }: { data: WaferDistribution[] }) {
  const series = data.filter((item) => item.samples.length);
  if (!series.length) {
    return <div style={{ color: C.muted, padding: 36, textAlign: "center" }}>這個事件沒有可用的數值資料。</div>;
  }

  const width = 760;
  const height = 320;
  const pad = { left: 58, right: 28, top: 24, bottom: 46 };
  const values = series.flatMap((item) => item.samples.map((sample) => sample.value));
  const lowLimit = series.find((item) => item.lowLimit != null)?.lowLimit ?? null;
  const highLimit = series.find((item) => item.highLimit != null)?.highLimit ?? null;
  const min = Math.min(...values, lowLimit ?? Infinity);
  const max = Math.max(...values, highLimit ?? -Infinity);
  const range = Math.max(max - min, 1e-6);
  const x = (value: number) => pad.left + ((value - min) / range) * (width - pad.left - pad.right);
  const y = (probability: number) => height - pad.bottom - probability * (height - pad.top - pad.bottom);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const xTicks = Array.from({ length: 5 }, (_, index) => min + (range * index) / 4);

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="經驗累積分布圖" style={{ minWidth: 620, width: "100%", height: "auto", display: "block" }}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke={C.borderLight} />
              <text x={pad.left - 10} y={y(tick) + 4} textAnchor="end" fill={C.muted} fontSize="11" fontFamily={MONO}>{`${Math.round(tick * 100)}%`}</text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line x1={x(tick)} x2={x(tick)} y1={height - pad.bottom} y2={height - pad.bottom + 5} stroke={C.border} />
              <text x={x(tick)} y={height - pad.bottom + 19} textAnchor="middle" fill={C.muted} fontSize="10" fontFamily={MONO}>{tick.toFixed(2)}</text>
            </g>
          ))}
          <line x1={pad.left} x2={pad.left} y1={pad.top} y2={height - pad.bottom} stroke={C.border} />
          <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke={C.border} />
          {lowLimit != null && <>
            <line x1={x(lowLimit)} x2={x(lowLimit)} y1={pad.top} y2={height - pad.bottom} stroke={C.lcl} strokeDasharray="5 5" />
            <text x={Math.max(pad.left + 4, Math.min(x(lowLimit) + 5, width - 105))} y={pad.top + 14} fill={C.lcl} fontSize="10" fontFamily={MONO}>Low Limit {lowLimit}</text>
          </>}
          {highLimit != null && <>
            <line x1={x(highLimit)} x2={x(highLimit)} y1={pad.top} y2={height - pad.bottom} stroke={C.ucl} strokeDasharray="5 5" />
            <text x={Math.max(pad.left + 4, Math.min(x(highLimit) + 5, width - 112))} y={pad.top + 28} fill={C.ucl} fontSize="10" fontFamily={MONO}>High Limit {highLimit}</text>
          </>}
          {series.map((item, seriesIndex) => {
            const color = seriesIndex === 0 ? C.blue : `hsl(${seriesIndex * 47}, 58%, 48%)`;
            const points = item.samples.map((sample) => `${x(sample.value)},${y(sample.probability)}`).join(" ");
            return <polyline key={item.wafer} points={points} fill="none" stroke={color} strokeWidth={seriesIndex === 0 ? 3 : 1.6} strokeOpacity={seriesIndex === 0 ? 0.95 : 0.52} strokeLinejoin="round" />;
          })}
          <text x={width / 2} y={height - 8} textAnchor="middle" fill={C.muted} fontSize="11">Measured value{series[0].unit ? ` (${series[0].unit})` : ""}</text>
          <text x="14" y={height / 2} textAnchor="middle" transform={`rotate(-90 14 ${height / 2})`} fill={C.muted} fontSize="11">Cumulative probability</text>
        </svg>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, borderTop: `1px solid ${C.borderLight}`, paddingTop: 12, color: C.muted, fontSize: 12 }}>
        <span><b style={{ color: C.text }}>Wafers</b> {series.length}</span>
        <span><b style={{ color: C.text }}>Samples</b> {values.length}</span>
        {lowLimit != null && <span style={{ color: C.lcl }}>Low {lowLimit}</span>}
        {highLimit != null && <span style={{ color: C.ucl }}>High {highLimit}</span>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 12, maxHeight: 72, overflowY: "auto" }}>
        {series.map((item, index) => <span key={item.wafer} style={{ color: C.muted, fontFamily: MONO, fontSize: 10 }}><i style={{ display: "inline-block", width: 14, height: 3, verticalAlign: "middle", marginRight: 4, background: index === 0 ? C.blue : `hsl(${index * 47}, 58%, 48%)` }} />{item.wafer}</span>)}
      </div>
    </div>
  );
}
