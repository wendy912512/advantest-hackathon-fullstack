import type { TrendSeries } from "./types";
import { generateTrendSeries } from "./mock";

// TODO: 後端串接完成後，改為 apiClient.get<TrendSeries[]>("/trends")
export async function fetchTrendSeries(): Promise<TrendSeries[]> {
  return generateTrendSeries();
}
