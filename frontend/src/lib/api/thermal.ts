import type { ThermalValidationPending, ThermalValidationReport, WaferThermal } from "./types";
import { apiClient } from "./client";
import { getCsvWaferThermal } from "./csvFallback";
import { fetchWithFallback } from "./withFallback";

// 場景二：某一片 wafer 上每個 device 的 sensor 預測（見 backend/app/thermal.py）。
// 後端沒資料（404 / 連線失敗）時，僅使用由 W01 CSV 產生的 fallback。
export async function fetchWaferThermal(lot: string, wafer: string): Promise<WaferThermal | undefined> {
  return fetchWithFallback(
    async () => {
      const { data } = await apiClient.get<WaferThermal>(`/thermal/wafers/${encodeURIComponent(lot)}/${encodeURIComponent(wafer)}`);
      return data;
    },
    () => getCsvWaferThermal(lot, wafer),
    (data) => !data || data.devices.length === 0,
  );
}

// 驗證是離線產生的報告，後端未產生或尚未部署時回傳 undefined，避免把
// CSV fallback 的預測資料誤當成正式模型驗證結果。
export async function fetchThermalValidationReport(): Promise<ThermalValidationReport | ThermalValidationPending | undefined> {
  try {
    const { data } = await apiClient.get<ThermalValidationReport>("/thermal/validation-report");
    return data.status === "generating" ? data as ThermalValidationPending : data;
  } catch {
    return undefined;
  }
}
