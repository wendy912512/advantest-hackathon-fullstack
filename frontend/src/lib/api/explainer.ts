import type { FailureExplanation } from "./types";
import { apiClient } from "./client";
import { getCsvExplanations } from "./csvFallback";
import { fetchWithFallback } from "./withFallback";

// 目前是規則式（rule-based）文字模板，非真正的模型推論，見 Notion 對齊表
export async function fetchFailureExplanations(limit = 8): Promise<FailureExplanation[]> {
  return fetchWithFallback(
    async () => {
      const { data } = await apiClient.get<FailureExplanation[]>("/failures/explain", { params: { limit } });
      return data;
    },
    () => getCsvExplanations(limit),
    // 沒有可解釋的 Fail 是有效狀態，不應該補入虛構異常通知。
    (data) => !data,
  );
}
