import type { ThermalValidationPending, ThermalValidationReport, WaferThermal } from "./types";
import { apiClient } from "./client";

// 場景二完全以 FastAPI 的即時資料為準。不能讓 CSV mock 在後端回 404 時
// 偽裝成即時 Sensor 5/6 資料，否則會掩蓋測試機 callback 的問題。
export async function fetchWaferThermal(lot: string, wafer: string): Promise<WaferThermal | undefined> {
  try {
    const { data } = await apiClient.get<WaferThermal>(`/thermal/wafers/${encodeURIComponent(lot)}/${encodeURIComponent(wafer)}`);
    return data.devices.length > 0 ? data : undefined;
  } catch {
    return undefined;
  }
}

// 驗證是離線產生的報告，後端未產生或尚未部署時回傳 undefined，避免把
// CSV fallback 的預測資料誤當成正式模型驗證結果。
export async function fetchThermalValidationReport(): Promise<ThermalValidationReport | ThermalValidationPending | undefined> {
  try {
    const { data } = await apiClient.get<ThermalValidationReport | ThermalValidationPending>("/thermal/validation-report");
    return data;
  } catch {
    return undefined;
  }
}
