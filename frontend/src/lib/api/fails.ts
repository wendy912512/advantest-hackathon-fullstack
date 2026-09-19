import type { WaferFails } from "./types";
import { apiClient } from "./client";
import { getCsvWaferFails } from "./csvFallback";
import { fetchWithFallback } from "./withFallback";

// Sites 頁 Table 用：某片 wafer 的 Fail 異常事件（見 backend/app/state.py 的 wafer_fails()）。
export async function fetchWaferFails(lot: string, wafer: string): Promise<WaferFails | undefined> {
  return fetchWithFallback(
    async () => {
      const { data } = await apiClient.get<WaferFails>(`/lots/${encodeURIComponent(lot)}/wafers/${encodeURIComponent(wafer)}/fails`);
      return data;
    },
    () => getCsvWaferFails(lot, wafer),
    // rows 為空代表這片 wafer 沒有 Fail，這是有效的後端結果；只有沒有
    // 回傳物件時才使用 CSV-derived fallback。
    (data) => !data,
  );
}
