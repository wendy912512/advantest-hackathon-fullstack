import type { DeviceTestResult, SiteSummary } from "./types";
import { apiClient } from "./client";
import { getCsvSiteResults, getCsvSiteSummaries } from "./csvFallback";
import { fetchWithFallback } from "./withFallback";

export async function fetchSiteSummaries(): Promise<SiteSummary[]> {
  return fetchWithFallback(
    async () => {
      const { data } = await apiClient.get<SiteSummary[]>("/sites");
      return data;
    },
    getCsvSiteSummaries,
  );
}

export async function fetchSiteResults(site: number): Promise<DeviceTestResult[]> {
  return fetchWithFallback(
    async () => {
      const { data } = await apiClient.get<DeviceTestResult[]>(`/sites/${site}/results`);
      return data;
    },
    () => getCsvSiteResults(site),
  );
}

export async function fetchSiteSummary(site: number): Promise<SiteSummary | undefined> {
  const summaries = await fetchSiteSummaries();
  return summaries.find((s) => s.site === site);
}
