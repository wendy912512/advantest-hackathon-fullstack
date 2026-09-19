import type { WaferMapData } from "./types";
import { apiClient } from "./client";

// TODO: 後端串接完成後，改為 apiClient.get<WaferMapData>(`/lots/${lot}/wafers/${wafer}`)
export async function fetchWaferMapData(
  lot: string,
  wafer: string,
): Promise<WaferMapData | undefined> {
  const { data } = await apiClient.get<WaferMapData>(`/lots/${lot}/wafers/${wafer}`);
  return data;
}
