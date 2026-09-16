import type {
  DashboardSnapshot,
  DeviceInfo,
  DeviceTestResult,
  SiteSummary,
  TrendAlert,
} from "./types";

// 模擬 ONEAPI consumeData() 收到的即時測試資料。
// 後端串接後，此檔案可整份移除，改由 lib/api/dashboard.ts、lib/api/sites.ts 呼叫真實 API。

const SITE_COUNT = 4;
const IMBALANCED_SITE = 2; // demo：讓 Site 2 出現 imbalance
const TEST_SUITE_NAME = "VDD_LEAKAGE";
const TEST_NUMBER = 1042;

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function gaussian(rand: () => number, mean: number, stdDev: number) {
  const u1 = Math.max(rand(), 1e-6);
  const u2 = rand();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stdDev;
}

function mean(values: number[]) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]) {
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

let sequence = 0;

function generateDevice(site: number, lot: string, wafer: string, rand: () => number): DeviceTestResult {
  sequence += 1;
  const baseMean = 1.2;
  const baseStd = 0.08;
  const isImbalanced = site === IMBALANCED_SITE;
  const value = gaussian(
    rand,
    isImbalanced ? baseMean + 0.35 : baseMean,
    isImbalanced ? baseStd * 1.6 : baseStd,
  );
  const pass = value < 1.6;

  const device: DeviceInfo = {
    pid: `DEV-${lot}-${wafer}-${sequence.toString().padStart(5, "0")}`,
    lot,
    wafer,
    site,
    x: Math.floor(rand() * 40) - 20,
    y: Math.floor(rand() * 40) - 20,
    pf: pass ? "PASS" : "FAIL",
    softBin: pass ? 1 : 2 + Math.floor(rand() * 3),
    hardBin: pass ? 1 : 2 + Math.floor(rand() * 3),
    testTime: new Date(Date.now() - Math.floor(rand() * 60_000)).toISOString(),
  };

  return {
    device,
    results: [
      {
        testNumber: TEST_NUMBER,
        testSuiteName: TEST_SUITE_NAME,
        kind: "PARAMETRIC",
        value: Number(value.toFixed(4)),
        pass,
      },
    ],
  };
}

export function generateMockResults(count = 240): DeviceTestResult[] {
  const rand = seededRandom(42);
  const lot = "LOT-2026-0091";
  const wafer = "W07";
  const results: DeviceTestResult[] = [];
  for (let i = 0; i < count; i += 1) {
    const site = (i % SITE_COUNT) + 1;
    results.push(generateDevice(site, lot, wafer, rand));
  }
  return results;
}

export function summarizeBySite(results: DeviceTestResult[]): SiteSummary[] {
  const bySite = new Map<number, DeviceTestResult[]>();
  for (const r of results) {
    const list = bySite.get(r.device.site) ?? [];
    list.push(r);
    bySite.set(r.device.site, list);
  }

  const summaries: SiteSummary[] = [];
  const overallValues = results.flatMap((r) => r.results.map((res) => res.value ?? 0));
  const overallMean = mean(overallValues);

  for (const [site, list] of Array.from(bySite.entries()).sort((a, b) => a[0] - b[0])) {
    const values = list.flatMap((r) => r.results.map((res) => res.value ?? 0));
    const passCount = list.filter((r) => r.device.pf === "PASS").length;
    const siteMean = mean(values);
    const siteStd = stdDev(values);
    const deviation = Math.abs(siteMean - overallMean);
    const isAnomalous = deviation > 0.15;

    summaries.push({
      site,
      count: list.length,
      passRate: passCount / list.length,
      mean: Number(siteMean.toFixed(4)),
      stdDev: Number(siteStd.toFixed(4)),
      isAnomalous,
      anomalyReason: isAnomalous
        ? `平均值偏離整體 ${deviation.toFixed(3)}，疑似 site imbalance`
        : undefined,
    });
  }

  return summaries;
}

export function generateTrendAlerts(siteSummaries: SiteSummary[]): TrendAlert[] {
  const alerts: TrendAlert[] = [];
  for (const s of siteSummaries) {
    if (s.isAnomalous) {
      alerts.push({
        id: `alert-site-${s.site}`,
        site: s.site,
        testSuiteName: TEST_SUITE_NAME,
        direction: "SHIFT",
        detectedAt: new Date().toISOString(),
        message: s.anomalyReason ?? "偵測到量測值位移",
      });
    }
  }
  return alerts;
}

export function generateDashboardSnapshot(): DashboardSnapshot {
  const results = generateMockResults();
  const siteSummaries = summarizeBySite(results);
  const trendAlerts = generateTrendAlerts(siteSummaries);
  const passCount = results.filter((r) => r.device.pf === "PASS").length;

  return {
    generatedAt: new Date().toISOString(),
    currentLot: results[0]?.device.lot ?? "-",
    currentWafer: results[0]?.device.wafer ?? "-",
    totalDevicesTested: results.length,
    overallPassRate: passCount / results.length,
    siteSummaries,
    trendAlerts,
    recentResults: results.slice(-15).reverse(),
  };
}
