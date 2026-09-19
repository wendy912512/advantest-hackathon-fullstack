import type { DeviceTestResult, SiteSummary } from "./types";
import { apiClient } from "./client";

// TODO: 後端 ONEAPI 串接完成後，改為 apiClient.get<SiteSummary[]>("/sites")
export async function fetchSiteSummaries(): Promise<SiteSummary[]> {
  const { data } = await apiClient.get<SiteSummary[]>("/sites");
  return data;
}

// TODO: 後端串接完成後，改為 apiClient.get<DeviceTestResult[]>(`/sites/${site}/results`)
export async function fetchSiteResults(site: number): Promise<DeviceTestResult[]> {
  const { data } = await apiClient.get<DeviceTestResult[]>(`/sites/${site}/results`);
  return data;
}

export async function fetchSiteSummary(site: number): Promise<SiteSummary | undefined> {
  const summaries = await fetchSiteSummaries();
  return summaries.find((s) => s.site === site);
}
