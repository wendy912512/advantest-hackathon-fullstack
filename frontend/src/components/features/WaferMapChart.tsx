import type { WaferMapData } from "@/lib/api";

const SIZE = 420;
const PADDING = 20;

export function WaferMapChart({ data }: { data: WaferMapData }) {
  const scale = (SIZE / 2 - PADDING) / data.radius;
  const center = SIZE / 2;

  const toSvgX = (x: number) => center + x * scale;
  // SVG y 軸向下為正，晶圓座標習慣 y 向上為正，這裡做翻轉
  const toSvgY = (y: number) => center - y * scale;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto w-full max-w-md"
      role="img"
      aria-label={`${data.lot} ${data.wafer} wafer map`}
    >
      {/* 晶圓邊界 */}
      <circle
        cx={center}
        cy={center}
        r={data.radius * scale}
        fill="none"
        stroke="currentColor"
        className="text-muted-foreground"
        strokeWidth={1.5}
      />
      {/* Notch 標記（晶圓方向參考點，demo 固定畫在下方，真實方向需與工程師確認） */}
      <line
        x1={center}
        y1={center + data.radius * scale}
        x2={center}
        y2={center + data.radius * scale + 10}
        stroke="currentColor"
        className="text-muted-foreground"
        strokeWidth={2}
      />

      {data.points.map((p) => (
        <circle
          key={p.pid}
          cx={toSvgX(p.x)}
          cy={toSvgY(p.y)}
          r={p.pf === "FAIL" ? 2.6 : 2}
          fill={p.pf === "FAIL" ? "var(--destructive)" : "var(--primary)"}
          opacity={p.pf === "FAIL" ? 0.9 : 0.35}
        />
      ))}
    </svg>
  );
}
