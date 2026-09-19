import type { TrendSeries } from "@/lib/api";

const WIDTH = 640;
const HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 24, left: 48 };

export function TrendChart({ series }: { series: TrendSeries }) {
  const values = series.points.map((p) => p.value);
  const allValues = [...values, series.ucl, series.lcl];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const xForIndex = (i: number) =>
    PADDING.left + (i / Math.max(series.points.length - 1, 1)) * plotWidth;
  const yForValue = (v: number) =>
    PADDING.top + plotHeight - ((v - min) / range) * plotHeight;

  const linePoints = series.points
    .map((p, i) => `${xForIndex(i)},${yForValue(p.value)}`)
    .join(" ");

  const hasOutOfControl = series.points.some(
    (p) => p.value > series.ucl || p.value < series.lcl,
  );

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label={`Site ${series.site} ${series.testSuiteName} 趨勢圖`}
    >
      {/* UCL / LCL / baseline mean 參考線 */}
      <line
        x1={PADDING.left}
        x2={WIDTH - PADDING.right}
        y1={yForValue(series.ucl)}
        y2={yForValue(series.ucl)}
        stroke="var(--destructive)"
        strokeDasharray="4 4"
        strokeWidth={1}
      />
      <line
        x1={PADDING.left}
        x2={WIDTH - PADDING.right}
        y1={yForValue(series.lcl)}
        y2={yForValue(series.lcl)}
        stroke="var(--destructive)"
        strokeDasharray="4 4"
        strokeWidth={1}
      />
      <line
        x1={PADDING.left}
        x2={WIDTH - PADDING.right}
        y1={yForValue(series.baselineMean)}
        y2={yForValue(series.baselineMean)}
        stroke="currentColor"
        className="text-muted-foreground"
        strokeDasharray="2 3"
        strokeWidth={1}
      />

      {/* Y 軸標籤 */}
      <text x={4} y={yForValue(series.ucl) + 3} fontSize={9} className="fill-muted-foreground">
        UCL {series.ucl}
      </text>
      <text x={4} y={yForValue(series.lcl) + 3} fontSize={9} className="fill-muted-foreground">
        LCL {series.lcl}
      </text>

      {/* 量測值折線 */}
      <polyline
        points={linePoints}
        fill="none"
        stroke={hasOutOfControl ? "var(--destructive)" : "var(--primary)"}
        strokeWidth={2}
      />

      {series.points.map((p, i) => {
        const outOfControl = p.value > series.ucl || p.value < series.lcl;
        return (
          <circle
            key={p.timestamp}
            cx={xForIndex(i)}
            cy={yForValue(p.value)}
            r={outOfControl ? 3.5 : 2}
            fill={outOfControl ? "var(--destructive)" : "var(--primary)"}
          />
        );
      })}
    </svg>
  );
}
