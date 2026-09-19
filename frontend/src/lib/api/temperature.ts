import type { TemperatureSnapshot } from "./types";
import { apiClient } from "./client";
import { generateTemperatureSnapshot } from "./mock";
import { fetchWithMockFallback } from "./withFallback";

// 場景二（IC 溫度預測 + 通知機台軟體）。後端 state.temperature_snapshot()
// 目前刻意回傳空陣列（見 backend/app/state.py 註解：「Do not derive
// temperatures from unrelated parametric values」），因為真正的模型還沒
// 由資料分析夥伴接上。這裡的 mock 邏輯同樣只是展示資料流程用的線性推估，
// 不是訓練過的模型，兩邊都還在等真正的模型就緒，見 Notion 對齊表。
export async function fetchTemperatureSnapshot(): Promise<TemperatureSnapshot> {
  return fetchWithMockFallback(
    async () => {
      const { data } = await apiClient.get<TemperatureSnapshot>("/temperature/predict");
      return data;
    },
    generateTemperatureSnapshot,
    (data) => !data || data.predictions.length === 0,
  );
}
