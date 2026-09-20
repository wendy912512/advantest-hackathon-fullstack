import type { TrendSeries } from "./types";
import { apiClient } from "./client";
import { getCsvTrends } from "./csvFallback";
import { fetchWithFallback } from "./withFallback";

// 後端現在會用已載入的 CSV/OneAPI 資料計算 baseline、管制界線與趨勢告警。
// 「沒有告警」是有效結果，不能因為 alerts 為空就使用 fallback，否則畫面會混入
// 與目前 lot/wafer 不一致的示範資料。
export async function fetchTrendSeries(lot?: string, wafer?: string): Promise<TrendSeries[]> {
  return fetchWithFallback(
    async () => {
      const { data } = await apiClient.get<TrendSeries[]>("/trends", {
        params: lot && wafer ? { lot, wafer } : undefined,
      });
      return data;
    },
    () => getCsvTrends(lot, wafer),
    (data) => !data || data.length === 0,
  );
}
