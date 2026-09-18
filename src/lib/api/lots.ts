import type { LotListItem, LotSummary } from "./types";
import { generateLotList, generateLotSummary } from "./mock";

// TODO: 後端串接完成後，改為 apiClient.get<LotListItem[]>("/lots")
export async function fetchLotList(): Promise<LotListItem[]> {
  return generateLotList();
}

// TODO: 後端串接完成後，改為 apiClient.get<LotSummary>(`/lots/${lot}`)
export async function fetchLotSummary(lot: string): Promise<LotSummary | undefined> {
  return generateLotSummary(lot);
}
