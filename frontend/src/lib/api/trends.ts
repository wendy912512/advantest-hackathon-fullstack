import type { TrendSeries } from "./types";
import { apiClient } from "./client";
import { generateTrendSeries } from "./mock";
import { fetchWithMockFallback } from "./withFallback";

// 注意：後端 /api/trends 目前只回傳 baseline mean/UCL/LCL 與原始序列，alerts
// 永遠是空陣列（見 backend/app/state.py 的 trends()，還沒實作 Mean/Stdev
// Trend、Site unbalance 這些規則判斷）。這裡把「有序列但沒有告警」也視為
// 「不完整」而退回 mock，這樣畫面才會示範完整的告警卡片；等後端補上判斷
// 邏輯後，把下面的 isEmpty 條件拿掉即可直接吃真實告警。
export async function fetchTrendSeries(): Promise<TrendSeries[]> {
  return fetchWithMockFallback(
    async () => {
      const { data } = await apiClient.get<TrendSeries[]>("/trends");
      return data;
    },
    generateTrendSeries,
    (data) => !data || data.length === 0 || data.every((s) => s.alerts.length === 0),
  );
}
