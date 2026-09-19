import type { WaferMapData } from "@/lib/api";
import { C } from "@/lib/theme";
import { BIN_COLORS } from "@/lib/binLabels";

// 抽成共用元件：Sites 頁（單一 wafer 檢視）跟 Wafer Browser 頁（點 wafer grid
// 檢視）都要畫同一種圓形 wafer map。
export function WaferMap({ data, size = 280 }: { data: WaferMapData; size?: number }) {
  const scale = (size / 2 - 6) / data.radius;
  const center = size / 2;
  const toSvgX = (x: number) => center + x * scale;
  const toSvgY = (y: number) => center - y * scale;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: "#F0F0F0", border: `2px solid ${C.border}`, flexShrink: 0 }}>
      <svg width={size} height={size}>
        {data.points.map((p) => (
          <circle
            key={p.pid}
            cx={toSvgX(p.x)}
            cy={toSvgY(p.y)}
            r={p.pf === "FAIL" ? 3 : 2.4}
            fill={p.pf === "FAIL" ? (BIN_COLORS[p.softBin] ?? C.red) : BIN_COLORS[1]}
            opacity={p.pf === "FAIL" ? 0.85 : 0.55}
          />
        ))}
      </svg>
    </div>
  );
}
