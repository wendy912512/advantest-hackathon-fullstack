// Bin 名稱：只顯示官方 bin table 有的內容（SmarTest 的 DefineBins.java 與
// py-app.log 印出來的）——Bin 1 叫 "passed"，其餘是 bin2…bin32，沒有更細的
// 說明，所以不自己編涵義。之後拿到真實的 bin 定義再加在這裡，並同步
// backend/app/bin_labels.py。
export const SOFT_BIN_LABELS: Record<number, string> = {
  1: "passed",
};

export const HARD_BIN_LABELS: Record<number, string> = {
  1: "passed",
};

export const BIN_COLORS: Record<number, string> = {
  1: "#43A047",
  2: "#EF5350",
  3: "#FF8A65",
  4: "#AB47BC",
};

export function binLabel(bin: number): string {
  return SOFT_BIN_LABELS[bin] ?? `bin${bin}`;
}

export function hardBinLabel(bin: number): string {
  return HARD_BIN_LABELS[bin] ?? `bin${bin}`;
}

export function binColor(bin: number): string {
  return BIN_COLORS[bin] ?? "#9E9E9E";
}

// 表格用：官方名稱本身就含編號（bin3）時只寫名稱，不重複成「3（bin3）」
function formatBin(bin: number, name: string): string {
  return name === `bin${bin}` ? name : `${bin}（${name}）`;
}

export function formatSoftBin(bin: number): string {
  return formatBin(bin, binLabel(bin));
}

export function formatHardBin(bin: number): string {
  return formatBin(bin, hardBinLabel(bin));
}
