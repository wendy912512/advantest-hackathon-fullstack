import type { TrendSeries } from "./types";
import { apiClient } from "./client";

// 趨勢告警必須來自後端目前載入的 CSV/OneAPI 資料。
// API 尚未啟動時顯示空結果，不能退回舊的 ALL fixture，避免工程師把示範資料
// 誤認成目前 lot/wafer 的實際趨勢。
export async function fetchTrendSeries(lot?: string, wafer?: string, site?: number): Promise<TrendSeries[]> {
  try {
    const { data } = await apiClient.get<TrendSeries[]>("/trends", {
      params: lot && wafer ? { lot, wafer, ...(site ? { site } : {}) } : undefined,
    });
    return data ?? [];
  } catch {
    return [];
  }
}
