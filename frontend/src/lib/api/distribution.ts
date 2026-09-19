import type { WaferDistribution } from "./types";
import { apiClient } from "./client";
import { getCsvWaferDistribution } from "./csvFallback";

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
    if (data?.events.length || data?.samples.length) return data;
    return getCsvWaferDistribution(lot, wafer, event);
  } catch {
    return getCsvWaferDistribution(lot, wafer, event);
  }
}
