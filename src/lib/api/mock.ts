import type {
  DashboardSnapshot,
  DeviceInfo,
  DeviceTestResult,
  SiteSummary,
  TrendAlert,
  TrendPoint,
  TrendSeries,
} from "./types";

// 模擬 ONEAPI consumeData() 收到的即時測試資料。
// 後端串接後，此檔案可整份移除，改由 lib/api/dashboard.ts、lib/api/sites.ts 呼叫真實 API。

const SITE_COUNT = 4;
const IMBALANCED_SITE = 2; // demo：讓 Site 2 出現 imbalance
const TEST_SUITE_NAME = "VDD_LEAKAGE";
const TEST_NUMBER = 1042;

// 趨勢判斷規則參數（demo 用固定值，真實規則需與後端/工程師確認，見 Notion 對齊表）
const TREND_BASELINE_WINDOW = 10; // 前 N 點做為 baseline，算 mean/std
const TREND_CONSECUTIVE_RUN = 6; // 連續 N 點單邊上升/下降算 trend
const TREND_SHIFT_RUN = 8; // 連續 N 點落在 baseline mean 同一側算 shift
const TREND_POINT_INTERVAL_MS = 2 * 60_000; // 每點間隔 2 分鐘
const TREND_SERIES_LENGTH = 30;

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

// site 各自的模擬趨勢模式：stable（正常）、drift-up（緩慢漂移）、level-shift（某時間點後突然位移）
type TrendPattern = "stable" | "drift-up" | "level-shift";

const SITE_TREND_PATTERN: Record<number, TrendPattern> = {
  1: "stable",
  2: "stable", // Site 2 的異常屬於 imbalance（見 summarizeBySite），不重複做成 trend
  3: "drift-up",
  4: "level-shift",
};

function generateSeriesValues(site: number, rand: () => number): number[] {
  const baseMean = site === IMBALANCED_SITE ? 1.2 + 0.35 : 1.2;
  const baseStd = 0.08;
  const pattern = SITE_TREND_PATTERN[site] ?? "stable";
  const values: number[] = [];

  for (let i = 0; i < TREND_SERIES_LENGTH; i += 1) {
    let pointMean = baseMean;
    if (pattern === "drift-up") {
      pointMean += (i / TREND_SERIES_LENGTH) * 0.4; // 逐漸往上漂移
    } else if (pattern === "level-shift" && i >= TREND_SERIES_LENGTH * 0.6) {
      pointMean += 0.3; // 後段整體位移
    }
    values.push(gaussian(rand, pointMean, baseStd));
  }
  return values;
}

function longestRun(direction: (a: number, b: number) => boolean, values: number[]): number {
  let longest = 1;
  let current = 1;
  for (let i = 1; i < values.length; i += 1) {
    if (direction(values[i - 1], values[i])) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

function detectTrendAlerts(site: number, points: TrendPoint[], baselineMean: number, baselineStdDev: number): TrendAlert[] {
  const alerts: TrendAlert[] = [];
  const values = points.map((p) => p.value);
  const ucl = baselineMean + 3 * baselineStdDev;
  const lcl = baselineMean - 3 * baselineStdDev;

  const outOfControl = values.some((v) => v > ucl || v < lcl);
  if (outOfControl) {
    alerts.push({
      id: `trend-${site}-ooc`,
      site,
      testSuiteName: TEST_SUITE_NAME,
      direction: "SHIFT",
      detectedAt: new Date().toISOString(),
      message: `量測值超出管制界線（UCL ${ucl.toFixed(3)} / LCL ${lcl.toFixed(3)}）`,
    });
  }

  const risingRun = longestRun((a, b) => b > a, values);
  const fallingRun = longestRun((a, b) => b < a, values);
  if (risingRun >= TREND_CONSECUTIVE_RUN) {
    alerts.push({
      id: `trend-${site}-up`,
      site,
      testSuiteName: TEST_SUITE_NAME,
      direction: "UP",
      detectedAt: new Date().toISOString(),
      message: `連續 ${risingRun} 點持續上升，疑似製程漂移`,
    });
  } else if (fallingRun >= TREND_CONSECUTIVE_RUN) {
    alerts.push({
      id: `trend-${site}-down`,
      site,
      testSuiteName: TEST_SUITE_NAME,
      direction: "DOWN",
      detectedAt: new Date().toISOString(),
      message: `連續 ${fallingRun} 點持續下降，疑似製程漂移`,
    });
  }

  const lastRun = values.slice(-TREND_SHIFT_RUN);
  if (lastRun.length === TREND_SHIFT_RUN) {
    const allAbove = lastRun.every((v) => v > baselineMean);
    const allBelow = lastRun.every((v) => v < baselineMean);
    if ((allAbove || allBelow) && !outOfControl) {
      alerts.push({
        id: `trend-${site}-shift`,
        site,
        testSuiteName: TEST_SUITE_NAME,
        direction: "SHIFT",
        detectedAt: new Date().toISOString(),
        message: `最近 ${TREND_SHIFT_RUN} 點全部落在 baseline 平均值同一側，疑似整體位移`,
      });
    }
  }

  return alerts;
}

export function generateTrendSeries(): TrendSeries[] {
  const rand = seededRandom(88);
  const series: TrendSeries[] = [];

  for (let site = 1; site <= SITE_COUNT; site += 1) {
    const values = generateSeriesValues(site, rand);
    const now = Date.now();
    const points: TrendPoint[] = values.map((value, i) => ({
      timestamp: new Date(
        now - (TREND_SERIES_LENGTH - 1 - i) * TREND_POINT_INTERVAL_MS,
      ).toISOString(),
      value: Number(value.toFixed(4)),
    }));

    const baselineValues = values.slice(0, TREND_BASELINE_WINDOW);
    const baselineMean = mean(baselineValues);
    const baselineStdDev = stdDev(baselineValues);
    const alerts = detectTrendAlerts(site, points, baselineMean, baselineStdDev);

    series.push({
      site,
      testSuiteName: TEST_SUITE_NAME,
      points,
      baselineMean: Number(baselineMean.toFixed(4)),
      baselineStdDev: Number(baselineStdDev.toFixed(4)),
      ucl: Number((baselineMean + 3 * baselineStdDev).toFixed(4)),
      lcl: Number((baselineMean - 3 * baselineStdDev).toFixed(4)),
      alerts,
    });
  }

  return series;
}

export function generateDashboardSnapshot(): DashboardSnapshot {
  const results = generateMockResults();
  const siteSummaries = summarizeBySite(results);
  const trendSeries = generateTrendSeries();
  const passCount = results.filter((r) => r.device.pf === "PASS").length;

  // 合併 imbalance 告警（來自 siteSummaries）與趨勢告警（來自 trendSeries），避免同一 site 重複顯示
  const trendAlerts: TrendAlert[] = [];
  for (const s of siteSummaries) {
    if (s.isAnomalous) {
      trendAlerts.push({
        id: `alert-site-${s.site}-imbalance`,
        site: s.site,
        testSuiteName: TEST_SUITE_NAME,
        direction: "SHIFT",
        detectedAt: new Date().toISOString(),
        message: s.anomalyReason ?? "偵測到量測值位移",
      });
    }
  }
  for (const series of trendSeries) {
    trendAlerts.push(...series.alerts);
  }

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
