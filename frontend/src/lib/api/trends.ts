import type { TrendSeries } from "./types";
import { apiClient } from "./client";

// TODO: 後端串接完成後，改為 apiClient.get<TrendSeries[]>("/trends")
export async function fetchTrendSeries(): Promise<TrendSeries[]> {
  const { data } = await apiClient.get<TrendSeries[]>("/trends");
  return data;
}
