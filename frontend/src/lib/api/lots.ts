import type { LotListItem, LotSummary } from "./types";
import { apiClient } from "./client";
import { generateLotList, generateLotSummary } from "./mock";
import { fetchWithMockFallback } from "./withFallback";

export async function fetchLotList(): Promise<LotListItem[]> {
  return fetchWithMockFallback(
    async () => {
      const { data } = await apiClient.get<LotListItem[]>("/lots");
      return data;
    },
    generateLotList,
  );
}

export async function fetchLotSummary(lot: string): Promise<LotSummary | undefined> {
  return fetchWithMockFallback(
    async () => {
      const { data } = await apiClient.get<LotSummary>(`/lots/${encodeURIComponent(lot)}`);
      return data;
    },
    () => generateLotSummary(lot),
    (data) => !data,
  );
}
