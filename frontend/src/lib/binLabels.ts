// Soft Bin 對照表：Bin 1 是 PASS，其餘編號各自對應不同的失敗原因分類。
// 這是 demo 用的示範對照表（真實 bin 定義要跟工程師/SmarTest bin table
// 確認，見 Notion 對齊表），但整個專案（mock 資料、UI 顯示、後端）都要用
// 同一份，不要有的地方顯示真實原因、有的地方顯示裸的「Bin 2」數字。
// 跟 backend/app/bin_labels.py 保持一致。
export const SOFT_BIN_LABELS: Record<number, string> = {
  1: "Pass",
  2: "Leakage Fail",
  3: "Timing Fail",
  4: "Functional Fail",
};

export const BIN_COLORS: Record<number, string> = {
  1: "#43A047",
  2: "#EF5350",
  3: "#FF8A65",
  4: "#AB47BC",
};

export function binLabel(bin: number): string {
  return SOFT_BIN_LABELS[bin] ?? `Bin ${bin}（未定義）`;
}

export function binColor(bin: number): string {
  return BIN_COLORS[bin] ?? "#9E9E9E";
}
