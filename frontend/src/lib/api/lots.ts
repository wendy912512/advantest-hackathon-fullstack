import type { LotListItem, LotSummary } from "./types";
import { apiClient } from "./client";

// TODO: 後端串接完成後，改為 apiClient.get<LotListItem[]>("/lots")
export async function fetchLotList(): Promise<LotListItem[]> {
  const { data } = await apiClient.get<LotListItem[]>("/lots");
  return data;
}

// TODO: 後端串接完成後，改為 apiClient.get<LotSummary>(`/lots/${lot}`)
export async function fetchLotSummary(lot: string): Promise<LotSummary | undefined> {
  const { data } = await apiClient.get<LotSummary>(`/lots/${lot}`);
  return data;
}
