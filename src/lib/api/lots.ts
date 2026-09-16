import type { LotSummary } from "./types";
import { generateLotSummary } from "./mock";

// TODO: 後端串接完成後，改為 apiClient.get<LotSummary>("/lots/current")
export async function fetchLotSummary(): Promise<LotSummary> {
  return generateLotSummary();
}
