"use client";

import { useState } from "react";
import type { WaferMapData } from "@/lib/api";
import { C } from "@/lib/theme";
import { BIN_COLORS, binLabel } from "@/lib/binLabels";
import { IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";

// 抽成共用元件：Sites 頁（單一 wafer 檢視）跟 Wafer Browser 頁（點 wafer grid
// 檢視）都要畫同一種圓形 wafer map。
export function WaferMap({ data, size = 280 }: { data: WaferMapData; size?: number }) {
  const [hovered, setHovered] = useState<WaferMapData["points"][number] | null>(null);
  // 不直接把 CSV 的 X/Y 當成固定半徑座標：訓練資料的座標範圍約為 0~11，
  // 但 API 預設半徑是 20，直接相除會讓所有 device 縮在圓心。先依目前
  // wafer 的座標範圍置中並填滿可視圓盤；真正的圓半徑仍由外框表達。
  const xValues = data.points.map((point) => point.x);
  const yValues = data.points.map((point) => point.y);
  const minX = Math.min(...xValues, 0);
  const maxX = Math.max(...xValues, 0);
  const minY = Math.min(...yValues, 0);
  const maxY = Math.max(...yValues, 0);
  const coordinateCenterX = (minX + maxX) / 2;
  const coordinateCenterY = (minY + maxY) / 2;
  const coordinateRadius = Math.max((maxX - minX) / 2, (maxY - minY) / 2, 1);
  const scale = (size / 2 - 14) / coordinateRadius;
  const center = size / 2;
  const toSvgX = (x: number) => center + (x - coordinateCenterX) * scale;
  const toSvgY = (y: number) => center - (y - coordinateCenterY) * scale;
  const tooltipLeft = hovered ? (toSvgX(hovered.x) < center ? size + 18 : -175) : 0;
  const tooltipTop = hovered ? Math.max(Math.min(toSvgY(hovered.y) - 34, size - 82), 8) : 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: "#F0F0F0", border: `2px solid ${C.border}` }}>
        <svg width={size} height={size} onMouseLeave={() => setHovered(null)}>
        {data.points.map((p) => (
          <circle
            key={p.pid}
            cx={toSvgX(p.x)}
            cy={toSvgY(p.y)}
            r={p.pf === "FAIL" ? 3 : 2.4}
            fill={p.pf === "FAIL" ? C.red : BIN_COLORS[1]}
            opacity={p.pf === "FAIL" ? 0.85 : 0.55}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered(p)}
          >
            <title>{`Device ${p.pid} | X: ${p.x}, Y: ${p.y} | Site ${p.site} | ${p.pf}`}</title>
          </circle>
        ))}
        </svg>
      </div>
      {hovered && (
        <>
          <div
            style={{
              position: "absolute",
              left: Math.min(toSvgX(hovered.x), tooltipLeft),
              top: toSvgY(hovered.y),
              width: Math.abs(tooltipLeft - toSvgX(hovered.x)),
              borderTop: `1px dashed ${hovered.pf === "PASS" ? "#72C58A" : "#E57373"}`,
              pointerEvents: "none",
              zIndex: 9,
            }}
          />
          <svg
            width={size}
            height={size}
            style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
          >
            <circle
              cx={toSvgX(hovered.x)}
              cy={toSvgY(hovered.y)}
              r={8}
              fill="rgba(255,255,255,0.85)"
              stroke={hovered.pf === "PASS" ? "#16803A" : "#C62828"}
              strokeWidth={2.5}
              style={{ filter: "drop-shadow(0 0 5px rgba(22,128,58,0.7))" }}
            />
            <circle cx={toSvgX(hovered.x)} cy={toSvgY(hovered.y)} r={3.2} fill={hovered.pf === "PASS" ? "#16803A" : "#C62828"} />
          </svg>
        </>
      )}
      {hovered && (
        <div
          style={{
            position: "absolute",
            left: tooltipLeft,
            top: tooltipTop,
            zIndex: 10,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            minWidth: 145,
            padding: "10px 12px",
            borderRadius: 9,
            background: "#fff",
            border: `1px solid ${hovered.pf === "PASS" ? "#A7DDB6" : "#F3B2B2"}`,
            color: "#374151",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11,
            lineHeight: 1.55,
            boxShadow: "0 5px 14px rgba(31, 41, 55, 0.16)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6, color: "#1F2937", fontWeight: 700 }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: hovered.pf === "PASS" ? "#DDF5E3" : "#FDE2E2", color: hovered.pf === "PASS" ? "#16803A" : "#C62828", fontSize: 10 }}>
              {hovered.pf === "PASS" ? <IconCircleCheck size={11} stroke={2} /> : <IconAlertTriangle size={11} stroke={2} />}
            </span>
            <span>Device {hovered.pid}</span>
            <span style={{ color: "#9CA3AF", fontWeight: 400 }}>· Site {hovered.site}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: "2px 10px" }}>
            <span style={{ color: "#9CA3AF" }}>X / Y</span>
            <span style={{ color: "#374151", fontWeight: 600 }}>{hovered.x} / {hovered.y}</span>
            <span style={{ color: "#9CA3AF" }}>狀態</span>
            <span style={{ color: hovered.pf === "PASS" ? "#16803A" : "#C62828", fontWeight: 700 }}>{hovered.pf === "PASS" ? "正常" : "Fail"}</span>
            <span style={{ color: "#9CA3AF" }}>結果</span>
            <span style={{ color: "#374151" }}>{binLabel(hovered.softBin)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
