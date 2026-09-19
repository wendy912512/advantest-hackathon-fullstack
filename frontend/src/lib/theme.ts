// MD3（Material Design 3）風格 token，從 /reference（Figma Make 產出的設計稿，
// frontend/reference/src/shared.tsx）搬過來，維持同一套顏色/字重/間距語彙。
// 這裡全部是 plain hex 字串，透過 inline style 使用，不走 Tailwind theme 變數，
// 所以不會跟現有 shadcn/ui（給 /about 頁面用）的 CSS variable 衝突。

export const C = {
  bg: "#F4F4F4",
  card: "#FFFFFF",
  surface: "#F7F7F7",
  surfaceVariant: "#EBEBEB",
  border: "#E0E0E0",
  borderLight: "#EEEEEE",
  text: "#1C1B1F",
  sub: "#49454F",
  muted: "#757575",
  dim: "#BDBDBD",
  green: "#1B6B36",
  greenBg: "#E8F5E9",
  greenBorder: "#A5D6A7",
  greenDot: "#43A047",
  yellow: "#795B00",
  yellowBg: "#FFFDE7",
  yellowBorder: "#FFD54F",
  red: "#B3261E",
  redBg: "#FCEDEB",
  redBorder: "#F2B8B5",
  blue: "#1A73E8",
  blueBg: "#E8F0FE",
  ucl: "#E65100",
  lcl: "#5E35B1",
  shadow: "0 1px 2px rgba(0,0,0,0.07), 0 1px 5px rgba(0,0,0,0.05)",
  shadowMd: "0 2px 6px rgba(0,0,0,0.09), 0 4px 16px rgba(0,0,0,0.07)",
} as const;

export const MONO = "'Roboto Mono', monospace";

export type SiteStatus = "normal" | "warning" | "error";

// Site 狀態規則：Error（Site imbalance 或 pass rate < 80%）、Warning（pass
// rate < 85% 或存在 Device Fail）、Normal（pass rate >= 85% 且沒有 Device Fail）。
export function siteStatus(passRate: number, isAnomalous?: boolean, failDeviceCount = 0): SiteStatus {
  if (isAnomalous || passRate < 0.8) return "error";
  if (passRate < 0.85 || failDeviceCount > 0) return "warning";
  return "normal";
}

// 後端 /api/sites 現在會回傳真正的五數彙總（SiteSummary.boxplot，見
// backend/app/state.py 的 five_number_summary()），這個函式只在那個欄位
// 缺席時（例如某個 site 量測值少於 2 筆）當作備援，用常態分布假設反推一個
// 視覺上合理的箱型圖範圍，不是精確統計量。
export function estimateBoxplotDist(mean: number, stdDev: number): [number, number, number, number, number] {
  const std = Math.max(stdDev, 1e-6);
  const q1 = mean - std * 0.67;
  const q3 = mean + std * 0.67;
  return [mean - std * 2, q1, mean, q3, mean + std * 2];
}
