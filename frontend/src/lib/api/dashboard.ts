import type { DashboardSnapshot } from "./types";
import { apiClient } from "./client";
import { generateDashboardSnapshot } from "./mock";
import { fetchWithMockFallback } from "./withFallback";

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  return fetchWithMockFallback(
    async () => {
      const { data } = await apiClient.get<DashboardSnapshot>("/dashboard/snapshot");
      return data;
    },
    generateDashboardSnapshot,
    (data) => !data || data.totalDevicesTested === 0,
  );
}
