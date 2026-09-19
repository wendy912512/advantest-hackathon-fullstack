import type { DashboardSnapshot } from "./types";
import { apiClient } from "./client";
import { fetchWithFallback } from "./withFallback";

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  return fetchWithFallback(
    async () => {
      const { data } = await apiClient.get<DashboardSnapshot>("/dashboard/snapshot");
      return data;
    },
    () => ({
      generatedAt: new Date().toISOString(),
      currentLot: "-",
      currentWafer: "-",
      totalDevicesTested: 0,
      overallPassRate: 0,
      siteSummaries: [],
      trendAlerts: [],
      recentResults: [],
    }),
    (data) => !data || data.totalDevicesTested === 0,
  );
}
