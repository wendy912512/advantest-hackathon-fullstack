import type { FailureExplanation } from "./types";
import { apiClient } from "./client";

// TODO: 後端/模型判斷邏輯就緒後，改為 apiClient.get<FailureExplanation[]>("/failures/explain")
// 目前是規則式（rule-based）文字模板，非真正的模型推論，見 Notion 對齊表
export async function fetchFailureExplanations(limit = 8): Promise<FailureExplanation[]> {
  const { data } = await apiClient.get<FailureExplanation[]>("/failures/explain", { params: { limit } });
  return data;
}
