import type { WaferFails } from "./types";
import { apiClient } from "./client";
import { generateWaferFails } from "./mock";
import { fetchWithMockFallback } from "./withFallback";

// Sites 頁 Table 用：某片 wafer 的 Fail 異常事件（見 backend/app/state.py 的 wafer_fails()）。
export async function fetchWaferFails(lot: string, wafer: string): Promise<WaferFails | undefined> {
  return fetchWithMockFallback(
    async () => {
      const { data } = await apiClient.get<WaferFails>(`/lots/${encodeURIComponent(lot)}/wafers/${encodeURIComponent(wafer)}/fails`);
      return data;
    },
    () => generateWaferFails(lot, wafer),
    (data) => !data || data.rows.length === 0,
  );
}
