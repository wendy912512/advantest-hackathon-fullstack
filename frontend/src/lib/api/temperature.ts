import type { TemperatureSnapshot } from "./types";
import { apiClient } from "./client";

// 場景二（IC 溫度預測 + 通知機台軟體）的資料介面。
// TODO: 真實模型/CSV 資料集就緒後，改為 apiClient.get<TemperatureSnapshot>("/temperature/predict")
// 目前 mock 邏輯是規則式線性推估，不是訓練過的模型，見 Notion 對齊表。
export async function fetchTemperatureSnapshot(): Promise<TemperatureSnapshot> {
  const { data } = await apiClient.get<TemperatureSnapshot>("/temperature/predict");
  return data;
}
