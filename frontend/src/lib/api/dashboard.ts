import type { DashboardSnapshot } from "./types";
import { apiClient } from "./client";
import { getCsvDashboard } from "./csvFallback";
import { fetchWithFallback } from "./withFallback";

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  return fetchWithFallback(
    async () => {
      const { data } = await apiClient.get<DashboardSnapshot>("/dashboard/snapshot");
      return data;
    },
    getCsvDashboard,
    (data) => !data || data.totalDevicesTested === 0,
  );
}
