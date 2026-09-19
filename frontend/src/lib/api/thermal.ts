import type { WaferThermal } from "./types";
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
