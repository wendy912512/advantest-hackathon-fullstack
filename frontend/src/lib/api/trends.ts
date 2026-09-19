import type { TrendSeries } from "./types";
import { apiClient } from "./client";
import { generateTrendSeries } from "./mock";
import { fetchWithMockFallback } from "./withFallback";

// 後端現在會用已載入的 CSV/OneAPI 資料計算 baseline、管制界線與趨勢告警。
// 「沒有告警」是有效結果，不能因為 alerts 為空就換回 mock，否則畫面會混入
// 與目前 lot/wafer 不一致的示範資料。
export async function fetchTrendSeries(): Promise<TrendSeries[]> {
  return fetchWithMockFallback(
    async () => {
      const { data } = await apiClient.get<TrendSeries[]>("/trends");
      return data;
    },
    generateTrendSeries,
    (data) => !data || data.length === 0,
  );
}
