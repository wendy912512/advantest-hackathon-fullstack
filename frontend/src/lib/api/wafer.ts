import type { WaferMapData } from "./types";
import { apiClient } from "./client";
import { getCsvWaferMap } from "./csvFallback";
import { fetchWithFallback } from "./withFallback";

export async function fetchWaferMapData(lot: string, wafer: string): Promise<WaferMapData | undefined> {
  return fetchWithFallback(
    async () => {
      const { data } = await apiClient.get<WaferMapData>(`/lots/${lot}/wafers/${wafer}`);
      return data;
    },
    () => getCsvWaferMap(lot, wafer),
    (data) => !data || data.points.length === 0,
  );
}
