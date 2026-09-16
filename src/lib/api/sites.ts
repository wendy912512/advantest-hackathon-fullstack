import type { DeviceTestResult, SiteSummary } from "./types";
import { generateMockResults, summarizeBySite } from "./mock";

// TODO: 後端 ONEAPI 串接完成後，改為 apiClient.get<SiteSummary[]>("/sites")
export async function fetchSiteSummaries(): Promise<SiteSummary[]> {
  return summarizeBySite(generateMockResults());
}

// TODO: 後端串接完成後，改為 apiClient.get<DeviceTestResult[]>(`/sites/${site}/results`)
export async function fetchSiteResults(site: number): Promise<DeviceTestResult[]> {
  return generateMockResults().filter((r) => r.device.site === site);
}

export async function fetchSiteSummary(site: number): Promise<SiteSummary | undefined> {
  const summaries = await fetchSiteSummaries();
  return summaries.find((s) => s.site === site);
}
