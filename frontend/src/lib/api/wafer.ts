import type { WaferMapData } from "./types";
import { apiClient } from "./client";
import { generateWaferMapData } from "./mock";
import { fetchWithMockFallback } from "./withFallback";

export async function fetchWaferMapData(lot: string, wafer: string): Promise<WaferMapData | undefined> {
  return fetchWithMockFallback(
    async () => {
      const { data } = await apiClient.get<WaferMapData>(`/lots/${lot}/wafers/${wafer}`);
      return data;
    },
    () => generateWaferMapData(lot, wafer),
    (data) => !data || data.points.length === 0,
  );
}
