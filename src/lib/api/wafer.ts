import type { WaferMapData } from "./types";
import { generateWaferMapData } from "./mock";

// TODO: 後端串接完成後，改為 apiClient.get<WaferMapData>("/wafer-map/current")
export async function fetchWaferMapData(): Promise<WaferMapData> {
  return generateWaferMapData();
}
