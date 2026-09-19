import type { WaferMapData } from "./types";
import { generateWaferMapData } from "./mock";

// TODO: 後端串接完成後，改為 apiClient.get<WaferMapData>(`/lots/${lot}/wafers/${wafer}`)
export async function fetchWaferMapData(
  lot: string,
  wafer: string,
): Promise<WaferMapData | undefined> {
  return generateWaferMapData(lot, wafer);
}
