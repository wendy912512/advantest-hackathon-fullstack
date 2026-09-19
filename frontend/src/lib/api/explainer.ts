import type { FailureExplanation } from "./types";
import { apiClient } from "./client";
import { explainFailures } from "./mock";
import { fetchWithMockFallback } from "./withFallback";

// 目前是規則式（rule-based）文字模板，非真正的模型推論，見 Notion 對齊表
export async function fetchFailureExplanations(limit = 8): Promise<FailureExplanation[]> {
  return fetchWithMockFallback(
    async () => {
      const { data } = await apiClient.get<FailureExplanation[]>("/failures/explain", { params: { limit } });
      return data;
    },
    () => explainFailures(limit),
  );
}
