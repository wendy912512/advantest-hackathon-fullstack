import type { LotListItem, LotSummary } from "./types";
import { apiClient } from "./client";
import { fetchWithFallback } from "./withFallback";

export async function fetchLotList(): Promise<LotListItem[]> {
  return fetchWithFallback(
    async () => {
      const { data } = await apiClient.get<LotListItem[]>("/lots");
      return data;
    },
    () => [],
  );
}

export async function fetchLotSummary(lot: string): Promise<LotSummary | undefined> {
  return fetchWithFallback(
    async () => {
      const { data } = await apiClient.get<LotSummary>(`/lots/${encodeURIComponent(lot)}`);
      return data;
    },
    () => undefined,
    (data) => !data,
  );
}
