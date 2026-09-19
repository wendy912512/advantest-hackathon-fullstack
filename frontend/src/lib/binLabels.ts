// CSV/OneAPI 只保證 Bin 1 代表通過；其他 Bin 目前沒有提供更細的失敗原因。
// UI 因此顯示可理解的狀態，不把 bin2、bin3 這類內部編號當成使用者訊息。
export const SOFT_BIN_LABELS: Record<number, string> = {
  1: "通過",
};

export const HARD_BIN_LABELS: Record<number, string> = {
  1: "通過",
};

export const BIN_COLORS: Record<number, string> = {
  1: "#43A047",
  2: "#EF5350",
  3: "#FF8A65",
  4: "#AB47BC",
};

export function binLabel(bin: number): string {
  return SOFT_BIN_LABELS[bin] ?? "測試失敗";
}

export function hardBinLabel(bin: number): string {
  return HARD_BIN_LABELS[bin] ?? "測試失敗";
}

export function binColor(bin: number): string {
  return BIN_COLORS[bin] ?? "#9E9E9E";
}

// 表格用：只顯示使用者可理解的狀態名稱，不重複顯示內部 bin 編號。
function formatBin(_bin: number, name: string): string {
  return name;
}

export function formatSoftBin(bin: number): string {
  return formatBin(bin, binLabel(bin));
}

export function formatHardBin(bin: number): string {
  return formatBin(bin, hardBinLabel(bin));
}
