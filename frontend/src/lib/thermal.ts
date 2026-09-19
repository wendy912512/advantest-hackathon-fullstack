import type { ThermalStatus, ThermalVerdict } from "@/lib/api";
import { C } from "@/lib/theme";

// CSV 的 PID 欄位是純數字（1~80），顯示成 PID12 這種格式。
export function formatPid(pid: string): string {
  return /^\d+$/.test(pid) ? `PID${pid}` : pid;
}

export const VERDICT_LABELS: Record<ThermalVerdict, string> = {
  hit: "預測成功",
  false_alarm: "誤報",
  miss: "漏報",
  ok: "預測正常，實測吻合",
};

export const STATUS_LABELS: Record<ThermalStatus, string> = {
  normal: "Normal",
  warning: "Warning",
  critical: "Critical",
  pending: "Pending",
};

export const STATUS_COLORS: Record<ThermalStatus, { fg: string; bg: string; border: string; glyph: string }> = {
  normal: { fg: C.green, bg: C.greenBg, border: C.greenBorder, glyph: "✓" },
  warning: { fg: C.yellow, bg: C.yellowBg, border: C.yellowBorder, glyph: "!" },
  critical: { fg: C.red, bg: C.redBg, border: C.redBorder, glyph: "✕" },
  pending: { fg: C.muted, bg: C.surfaceVariant, border: C.border, glyph: "·" },
};
