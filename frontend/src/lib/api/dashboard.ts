import type { DashboardSnapshot } from "./types";
import { apiClient } from "./client";

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const { data } = await apiClient.get<DashboardSnapshot>("/dashboard/snapshot");
  return data;
}
