import type { DeviceTestResult, SiteSummary } from "./types";
import { apiClient } from "./client";
import { generateMockResults, summarizeBySite } from "./mock";
import { fetchWithMockFallback } from "./withFallback";

export async function fetchSiteSummaries(): Promise<SiteSummary[]> {
  return fetchWithMockFallback(
    async () => {
      const { data } = await apiClient.get<SiteSummary[]>("/sites");
      return data;
    },
    () => summarizeBySite(generateMockResults()),
  );
}

export async function fetchSiteResults(site: number): Promise<DeviceTestResult[]> {
  return fetchWithMockFallback(
    async () => {
      const { data } = await apiClient.get<DeviceTestResult[]>(`/sites/${site}/results`);
      return data;
    },
    () => generateMockResults().filter((r) => r.device.site === site),
  );
}

export async function fetchSiteSummary(site: number): Promise<SiteSummary | undefined> {
  const summaries = await fetchSiteSummaries();
  return summaries.find((s) => s.site === site);
}
