import type { DashboardSnapshot } from "./types";
import { apiClient } from "./client";

// TODO: 後端 ONEAPI 串接完成後，改為 apiClient.get<DashboardSnapshot>("/dashboard/snapshot")
export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const { data } = await apiClient.get<DashboardSnapshot>("/dashboard/snapshot");
  return data;
}
