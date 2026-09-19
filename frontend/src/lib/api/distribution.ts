import type { WaferDistribution } from "./types";
import { apiClient } from "./client";

export async function fetchWaferDistribution(
  lot: string,
  wafer: string,
  event?: string,
): Promise<WaferDistribution | undefined> {
  try {
    const { data } = await apiClient.get<WaferDistribution>(
      `/lots/${encodeURIComponent(lot)}/wafers/${encodeURIComponent(wafer)}/distribution`,
      { params: event ? { event } : undefined },
    );
    return data;
  } catch {
    return undefined;
  }
}
