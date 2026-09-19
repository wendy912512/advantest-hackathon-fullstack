import type { DashboardSnapshot } from "./types";
import { generateDashboardSnapshot } from "./mock";

// TODO: 後端 ONEAPI 串接完成後，改為 apiClient.get<DashboardSnapshot>("/dashboard/snapshot")
export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  return generateDashboardSnapshot();
}
