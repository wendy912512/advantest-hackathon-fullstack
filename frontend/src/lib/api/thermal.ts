import type { WaferThermal } from "./types";
import { apiClient } from "./client";
import { generateWaferThermal } from "./mock";
import { fetchWithMockFallback } from "./withFallback";

// 場景二：某一片 wafer 上每個 device 的 sensor 預測（見 backend/app/thermal.py）。
// 後端沒資料（404 / 連線失敗）時退回 mock（真實 W01 資料重播，見 mock.ts）。
export async function fetchWaferThermal(lot: string, wafer: string): Promise<WaferThermal | undefined> {
  return fetchWithMockFallback(
    async () => {
      const { data } = await apiClient.get<WaferThermal>(`/thermal/wafers/${encodeURIComponent(lot)}/${encodeURIComponent(wafer)}`);
      return data;
    },
    () => generateWaferThermal(lot, wafer),
    (data) => !data || data.devices.length === 0,
  );
}
