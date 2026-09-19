import type {
  BinBreakdown,
  DashboardSnapshot,
  DeviceInfo,
  DeviceTestResult,
  FailureExplanation,
  LotListItem,
  LotSummary,
  MachineNotification,
  SiteSummary,
  TemperaturePrediction,
  TemperatureSnapshot,
  TrendAlert,
  TrendPoint,
  TrendSeries,
  WaferListItem,
  WaferMapData,
  WaferPoint,
} from "./types";
import { SOFT_BIN_LABELS } from "@/lib/binLabels";

// 模擬 ONEAPI consumeData() 收到的即時測試資料。
// 後端串接後，此檔案可整份移除，改由 lib/api/dashboard.ts、lib/api/sites.ts 呼叫真實 API。
//
// 主要測項數值（TEST_SUITE_NAME/TEST_NUMBER/UNIT/LOW_LIMIT/HIGH_LIMIT）參考自
// 實際 py-app.log（ACS ONEAPI 3.3.0 執行紀錄）裡的 Main.IDDQ_flow.IDDQ_A1 測項：
// TestNumber=80000、PinName=IO1、LowLimit≈12.1、HighLimit=30.0，
// 4 個 site 實測值落在 19.2~19.8 之間。單位（mA）是我依 IDDQ（靜態漏電流）測試
// 慣例假設的，log 裡該欄位實際是空字串，串接真實後端時請以 query_Unit 為準。

const SITE_COUNT = 4;
const IMBALANCED_SITE = 2; // demo：讓 Site 2 出現 imbalance
const TEST_SUITE_NAME = "IDDQ_A1";
const TEST_NUMBER = 80000;
const TEST_PIN_NAME = "IO1";
const TEST_UNIT = "mA";
const TEST_LOW_LIMIT = 12.1;
const TEST_HIGH_LIMIT = 30.0;

// Bin 對照表移到 @/lib/binLabels，跟前端 UI 元件（LotBrowser、SiteDrawer）與
// 後端 backend/app/bin_labels.py 共用同一份，避免有的地方顯示真實原因、
// 有的地方顯示裸的「Bin 2」數字。
// 官方訓練資料集（TrainDataInfo.txt）證實的真實門檻：25 片 wafer 中，
// W3（67.5%）與 W9（68.8%）被標記為「Low yield which yield is low than 80」，
// 其餘正常 wafer 良率都在 80% 以上，所以 80% 是官方認定的門檻，不是猜的。
const SITE_PASS_RATE_THRESHOLD = 0.8;
const BIN_RATIO_ALERT_THRESHOLD = 0.05; // 單一失敗 bin 佔比超過 5% 視為疑似系統性問題（demo 用）
// Site imbalance 判斷邏輯（median + MAD 穩健統計）在 summarizeBySite() 裡，
// 不再用固定的絕對偏差門檻——舊版「偏離 pooled mean 超過某個常數」的做法
// 有 pooled mean/threshold 被異常值自己拉偏的問題，詳見 summarizeBySite()
// 上方註解與 backend/app/state.py 的對應修正。

// Wafer map 參數（demo 用，真實晶圓尺寸/座標系統需與工程師確認，見 Notion 對齊表）
const WAFER_RADIUS = 20;
const WAFER_EDGE_RING_RATIO = 0.78; // 超過此比例半徑視為「邊緣」，demo 用來模擬 edge die effect

// 測試結果解釋器：bin 對應的失敗原因說明（demo 用規則式文字，真實原因需由工程師/模型判斷提供）
const BIN_CAUSE_HINTS: Record<number, string> = {
  2: "疑似漏電流（leakage）超出規格，常見原因為製程缺陷或 ESD 損傷",
  3: "疑似時序（timing）不符合，常見原因為時脈偏移或訊號完整性問題",
  4: "疑似功能性測試失敗，常見原因為邏輯錯誤或圖案敏感缺陷",
};

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

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  const mid = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2;
}

// 跟 numpy 預設的 'linear' method 一致的線性內插百分位數，跟後端
// backend/app/state.py 的 percentile() 用同一種算法，確保 mock 與真實
// 後端的箱型圖數字口徑一致。
function percentile(sortedValues: number[], fraction: number) {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = fraction * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.min(lower + 1, sortedValues.length - 1);
  const weight = index - lower;
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * weight;
}

function fiveNumberSummary(values: number[]): [number, number, number, number, number] | undefined {
  if (values.length < 2) return undefined;
  const ordered = [...values].sort((a, b) => a - b);
  return [
    ordered[0],
    percentile(ordered, 0.25),
    percentile(ordered, 0.5),
    percentile(ordered, 0.75),
    ordered[ordered.length - 1],
  ];
}

let sequence = 0;

function generateDevice(site: number, lot: string, wafer: string, rand: () => number): DeviceTestResult {
  sequence += 1;
  // baseline 取自真實 log 觀察到的 4 個 site 實測值（19.2~19.8），std 為 demo 估計值
  const baseMean = 19.5;
  const baseStd = 0.3;
  const isImbalanced = site === IMBALANCED_SITE;
  // 異常 site 的平均值刻意推向 High Limit（30.0）附近、標準差也放大，
  // 讓它同時呈現「site imbalance」（mean 偏移）與「real fail」（偶爾超出 spec）兩種訊號
  const value = gaussian(
    rand,
    isImbalanced ? baseMean + 8.5 : baseMean,
    isImbalanced ? 1.8 : baseStd,
  );
  const pass = value >= TEST_LOW_LIMIT && value <= TEST_HIGH_LIMIT;

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
        pinName: TEST_PIN_NAME,
        kind: "PARAMETRIC",
        value: Number(value.toFixed(4)),
        unit: TEST_UNIT,
        lowLimit: TEST_LOW_LIMIT,
        highLimit: TEST_HIGH_LIMIT,
        pass,
      },
    ],
  };
}

// 這是「目前正在測試中」的即時監控資料（Dashboard/Site/趨勢/解釋器用），跟
// LOT_DEFINITIONS 裡「已完成、可瀏覽歷史」的批次是分開的兩組資料，故意用不同的
// lot id（LOT-2026-0093）避免混淆——不是同一批貨。
export function generateMockResults(count = 240): DeviceTestResult[] {
  const rand = seededRandom(42);
  const lot = "LOT-2026-0093";
  const wafer = "W07";
  const results: DeviceTestResult[] = [];
  for (let i = 0; i < count; i += 1) {
    const site = (i % SITE_COUNT) + 1;
    results.push(generateDevice(site, lot, wafer, rand));
  }
  return results;
}

// Site imbalance 判斷：比較「各 site 的均值」彼此之間的分布，用 median +
// MAD（median absolute deviation，乘 1.4826 校正成與常態分布 stdDev 同尺度）
// 這種穩健統計量，而不是拿單一 site 均值去跟「所有原始量測值的 pooled
// mean/stdDev」比較。後者的問題：異常 site 自己的偏移與高變異會同時拉動
// pooled mean 與 pooled stdDev，讓判斷門檻自己被異常值撐大，導致真正異常
// 的 site 反而測不出來（在後端 backend/app/state.py 修正前實際發生過這個
// bug，用這裡的 demo 數值算過：偏移 8.5mA/std 1.8 vs baseline 19.5mA/std
// 0.3，pooled stdDev 會被撐到 ~3.8，3σ 門檻 ~11.4mA > 實際偏差 6.4mA，等於
// 測不出來）。median/MAD 只用「4 個 site 的均值」本身的分布來判斷，單一
// 離群 site 幾乎不會拉動中位數，這個邏輯跟 backend/app/state.py 的
// build_site_summaries() 是同一套，維持前後端行為一致。
export function summarizeBySite(results: DeviceTestResult[]): SiteSummary[] {
  const bySite = new Map<number, DeviceTestResult[]>();
  for (const r of results) {
    const list = bySite.get(r.device.site) ?? [];
    list.push(r);
    bySite.set(r.device.site, list);
  }

  const siteValues = new Map<number, number[]>();
  const siteMeans = new Map<number, number>();
  for (const [site, list] of bySite) {
    const values = list.flatMap((r) => r.results.map((res) => res.value ?? 0));
    siteValues.set(site, values);
    siteMeans.set(site, mean(values));
  }

  const meansList = Array.from(siteMeans.values());
  const robustCenter = meansList.length >= 3 ? median(meansList) : mean(meansList);
  const mad =
    meansList.length >= 3 ? median(meansList.map((m) => Math.abs(m - robustCenter))) : 0;
  const scaledMad = Math.max(mad * 1.4826, 1e-6);

  const summaries: SiteSummary[] = [];
  for (const [site, list] of Array.from(bySite.entries()).sort((a, b) => a[0] - b[0])) {
    const values = siteValues.get(site) ?? [];
    const passCount = list.filter((r) => r.device.pf === "PASS").length;
    const siteMean = siteMeans.get(site) ?? 0;
    const siteStd = stdDev(values);
    const deviation = Math.abs(siteMean - robustCenter);
    const isAnomalous = values.length >= 5 && meansList.length >= 3 && deviation > 3 * scaledMad;

    summaries.push({
      site,
      count: list.length,
      passRate: passCount / list.length,
      mean: Number(siteMean.toFixed(4)),
      stdDev: Number(siteStd.toFixed(4)),
      isAnomalous,
      anomalyReason: isAnomalous
        ? `Site unbalance：平均值偏離其他 site 中位數 ${deviation.toFixed(3)}`
        : undefined,
      boxplot: fiveNumberSummary(values),
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
  const baseMean = site === IMBALANCED_SITE ? 19.5 + 8.5 : 19.5;
  const baseStd = 0.3;
  const pattern = SITE_TREND_PATTERN[site] ?? "stable";
  const values: number[] = [];

  for (let i = 0; i < TREND_SERIES_LENGTH; i += 1) {
    let pointMean = baseMean;
    if (pattern === "drift-up") {
      pointMean += (i / TREND_SERIES_LENGTH) * 6; // 逐漸往上漂移，往 high limit（30.0）靠近
    } else if (pattern === "level-shift" && i >= TREND_SERIES_LENGTH * 0.6) {
      pointMean += 5; // 後段整體位移
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
      message: `Mean Trend Up：連續 ${risingRun} 點持續上升，疑似製程漂移`,
    });
  } else if (fallingRun >= TREND_CONSECUTIVE_RUN) {
    alerts.push({
      id: `trend-${site}-down`,
      site,
      testSuiteName: TEST_SUITE_NAME,
      direction: "DOWN",
      detectedAt: new Date().toISOString(),
      message: `Mean Trend Down：連續 ${fallingRun} 點持續下降，疑似製程漂移`,
    });
  }

  // Stdev Trend Up/Down：比較前後半段的標準差，呼應官方訓練資料集標記的 W23/W25 類別
  const half = Math.floor(values.length / 2);
  const firstHalfStd = stdDev(values.slice(0, half));
  const secondHalfStd = stdDev(values.slice(half));
  const stdRatio = secondHalfStd / Math.max(firstHalfStd, 1e-6);
  if (stdRatio > 1.6) {
    alerts.push({
      id: `trend-${site}-std-up`,
      site,
      testSuiteName: TEST_SUITE_NAME,
      direction: "SHIFT",
      detectedAt: new Date().toISOString(),
      message: `Stdev Trend Up：後半段標準差（${secondHalfStd.toFixed(3)}）是前半段（${firstHalfStd.toFixed(3)}）的 ${stdRatio.toFixed(1)} 倍，疑似製程穩定性下降`,
    });
  } else if (stdRatio < 0.62) {
    alerts.push({
      id: `trend-${site}-std-down`,
      site,
      testSuiteName: TEST_SUITE_NAME,
      direction: "SHIFT",
      detectedAt: new Date().toISOString(),
      message: `Stdev Trend Down：後半段標準差（${secondHalfStd.toFixed(3)}）明顯小於前半段（${firstHalfStd.toFixed(3)}），製程波動收斂`,
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

function binBreakdown(devices: DeviceInfo[], pick: (d: DeviceInfo) => number): BinBreakdown[] {
  const counts = new Map<number, number>();
  for (const d of devices) {
    const bin = pick(d);
    counts.set(bin, (counts.get(bin) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([bin, count]) => ({
      bin,
      label: SOFT_BIN_LABELS[bin] ?? `Bin ${bin}`,
      count,
      ratio: count / devices.length,
    }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// 多 Lot / 多 Wafer 瀏覽（品控實務：先選 Lot 看整批品質，再視需要點進某片 wafer
// 看熱區圖；wafer 之間不做逐片比較表，只在疑似問題清單裡標出離群的那一片）
// ---------------------------------------------------------------------------

type WaferPattern = "healthy" | "edge-effect" | "elevated-fail";

interface WaferDefinition {
  wafer: string;
  pattern: WaferPattern;
}

interface LotDefinition {
  lot: string;
  startedAt: string;
  wafers: WaferDefinition[];
}

// demo 用固定資料集：4 個 lot，每個 lot 5 片 wafer。真實 site/wafer 數量、每片
// device 數需與工程師確認，見 Notion 對齊表。
const LOT_DEFINITIONS: LotDefinition[] = [
  {
    lot: "LOT-2026-0091",
    startedAt: "2026-09-19T01:00:00.000Z",
    wafers: [
      { wafer: "W01", pattern: "healthy" },
      { wafer: "W02", pattern: "healthy" },
      { wafer: "W03", pattern: "edge-effect" },
      { wafer: "W04", pattern: "healthy" },
      { wafer: "W05", pattern: "elevated-fail" },
    ],
  },
  {
    lot: "LOT-2026-0089",
    startedAt: "2026-09-18T09:30:00.000Z",
    wafers: [
      { wafer: "W01", pattern: "healthy" },
      { wafer: "W02", pattern: "healthy" },
      { wafer: "W03", pattern: "healthy" },
      { wafer: "W04", pattern: "healthy" },
      { wafer: "W05", pattern: "healthy" },
    ],
  },
  {
    lot: "LOT-2026-0087",
    startedAt: "2026-09-17T14:15:00.000Z",
    wafers: [
      { wafer: "W01", pattern: "healthy" },
      { wafer: "W02", pattern: "edge-effect" },
      { wafer: "W03", pattern: "healthy" },
      { wafer: "W04", pattern: "healthy" },
      { wafer: "W05", pattern: "healthy" },
    ],
  },
  {
    lot: "LOT-2026-0085",
    startedAt: "2026-09-16T18:45:00.000Z",
    wafers: [
      { wafer: "W01", pattern: "healthy" },
      { wafer: "W02", pattern: "healthy" },
      { wafer: "W03", pattern: "healthy" },
      { wafer: "W04", pattern: "healthy" },
      { wafer: "W05", pattern: "healthy" },
    ],
  },
];

const WAFER_POINTS_PER_WAFER = 176;

function seedFromString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

function siteForAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  const normalized = ((angle % twoPi) + twoPi) % twoPi;
  return Math.floor(normalized / (twoPi / SITE_COUNT)) + 1;
}

function findWaferDefinition(lot: string, wafer: string): WaferDefinition | undefined {
  return LOT_DEFINITIONS.find((l) => l.lot === lot)?.wafers.find((w) => w.wafer === wafer);
}

// 依 wafer 的模擬樣式（健康／edge die effect／整體偏高失敗率）產生該片所有 device，
// 座標用極座標均勻取樣圓盤，site 依角度分成 4 象限（demo 簡化，真實 site 配置需與
// 工程師確認）。
function generateWaferDeviceResults(lot: string, wafer: string): DeviceTestResult[] {
  const def = findWaferDefinition(lot, wafer);
  const pattern = def?.pattern ?? "healthy";
  const rand = seededRandom(seedFromString(`${lot}-${wafer}`));
  const results: DeviceTestResult[] = [];

  for (let i = 0; i < WAFER_POINTS_PER_WAFER; i += 1) {
    const angle = rand() * 2 * Math.PI;
    const r = WAFER_RADIUS * Math.sqrt(rand());
    const x = Math.round(r * Math.cos(angle));
    const y = Math.round(r * Math.sin(angle));
    const site = siteForAngle(angle);
    const isEdge = r > WAFER_RADIUS * WAFER_EDGE_RING_RATIO;

    let failProbability = 0.05;
    if (pattern === "edge-effect" && isEdge) failProbability = 0.45;
    if (pattern === "elevated-fail") failProbability = 0.22;

    const pass = rand() > failProbability;
    const value = pass
      ? 19.5 + (rand() - 0.5) * 2 // 正常範圍內
      : TEST_HIGH_LIMIT + rand() * 3; // 超出 high limit

    sequence += 1;
    const device: DeviceInfo = {
      pid: `DEV-${lot}-${wafer}-${sequence.toString().padStart(5, "0")}`,
      lot,
      wafer,
      site,
      x,
      y,
      pf: pass ? "PASS" : "FAIL",
      softBin: pass ? 1 : 2 + Math.floor(rand() * 3),
      hardBin: pass ? 1 : 2 + Math.floor(rand() * 3),
      testTime: new Date(Date.now() - Math.floor(rand() * 60_000)).toISOString(),
    };

    results.push({
      device,
      results: [
        {
          testNumber: TEST_NUMBER,
          testSuiteName: TEST_SUITE_NAME,
          pinName: TEST_PIN_NAME,
          kind: "PARAMETRIC",
          value: Number(value.toFixed(4)),
          unit: TEST_UNIT,
          lowLimit: TEST_LOW_LIMIT,
          highLimit: TEST_HIGH_LIMIT,
          pass,
        },
      ],
    });
  }

  return results;
}

function waferListItem(lot: string, wafer: string): WaferListItem {
  const devices = generateWaferDeviceResults(lot, wafer).map((r) => r.device);
  const passCount = devices.filter((d) => d.pf === "PASS").length;
  const passRate = passCount / devices.length;
  return {
    wafer,
    totalDevices: devices.length,
    passRate,
    hasIssue: passRate < SITE_PASS_RATE_THRESHOLD,
  };
}

export function generateLotList(): LotListItem[] {
  return LOT_DEFINITIONS.map((def) => {
    const wafers = def.wafers.map((w) => waferListItem(def.lot, w.wafer));
    const totalDevices = wafers.reduce((sum, w) => sum + w.totalDevices, 0);
    const passRate =
      wafers.reduce((sum, w) => sum + w.passRate * w.totalDevices, 0) / totalDevices;

    return {
      lot: def.lot,
      waferCount: def.wafers.length,
      totalDevices,
      passRate,
      hasIssue: wafers.some((w) => w.hasIssue),
      startedAt: def.startedAt,
    };
  });
}

export function generateLotSummary(lot: string): LotSummary | undefined {
  const def = LOT_DEFINITIONS.find((l) => l.lot === lot);
  if (!def) return undefined;

  const results = def.wafers.flatMap((w) => generateWaferDeviceResults(lot, w.wafer));
  const devices = results.map((r) => r.device);
  const siteSummaries = summarizeBySite(results);
  const passCount = devices.filter((d) => d.pf === "PASS").length;
  const passRate = passCount / devices.length;

  const softBinBreakdown = binBreakdown(devices, (d) => d.softBin);
  const hardBinBreakdown = binBreakdown(devices, (d) => d.hardBin);
  const wafers = def.wafers.map((w) => waferListItem(lot, w.wafer));

  // 疑似問題清單：整批（lot）層級的訊號，加上「哪一片 wafer 明顯拖累整批」
  // 這種需要 drill-down 排查的離群點——但不是逐片互相比較表
  const suspectIssues: string[] = [];
  for (const s of siteSummaries) {
    if (s.passRate < SITE_PASS_RATE_THRESHOLD) {
      suspectIssues.push(
        `Site ${s.site} pass rate 為 ${(s.passRate * 100).toFixed(1)}%，低於門檻 ${(SITE_PASS_RATE_THRESHOLD * 100).toFixed(0)}%`,
      );
    }
  }
  for (const b of softBinBreakdown) {
    if (b.bin !== 1 && b.ratio > BIN_RATIO_ALERT_THRESHOLD) {
      suspectIssues.push(
        `Soft Bin ${b.bin}（${b.label}）佔比達 ${(b.ratio * 100).toFixed(1)}%，疑似系統性失效`,
      );
    }
  }
  // 跟 waferListItem() 的 hasIssue 用同一個門檻，避免 wafer 卡片標紅了、
  // 疑似問題清單卻沒列出來的不一致情況
  for (const w of wafers) {
    if (w.hasIssue) {
      suspectIssues.push(
        `Wafer ${w.wafer}：Low yield（pass rate ${(w.passRate * 100).toFixed(1)}%，低於官方門檻 ${(SITE_PASS_RATE_THRESHOLD * 100).toFixed(0)}%），建議點進去看 wafer map`,
      );
    }
  }

  return {
    lot,
    waferCount: def.wafers.length,
    totalDevices: devices.length,
    passRate,
    siteSummaries,
    softBinBreakdown,
    hardBinBreakdown,
    suspectIssues,
    wafers,
  };
}

export function generateWaferMapData(lot: string, wafer: string): WaferMapData | undefined {
  if (!findWaferDefinition(lot, wafer)) return undefined;

  const results = generateWaferDeviceResults(lot, wafer);
  const points: WaferPoint[] = results.map((r) => ({
    pid: r.device.pid,
    x: r.device.x,
    y: r.device.y,
    pf: r.device.pf,
    softBin: r.device.softBin,
  }));

  return {
    lot,
    wafer,
    radius: WAFER_RADIUS,
    points,
  };
}

export function explainFailures(limit = 8): FailureExplanation[] {
  const results = generateMockResults();
  const siteSummaries = summarizeBySite(results);
  const siteBySite = new Map(siteSummaries.map((s) => [s.site, s]));
  const fails = results.filter((r) => r.device.pf === "FAIL").slice(0, limit);

  return fails.map((r) => {
    const testResult = r.results[0];
    const value = testResult?.value ?? 0;
    const lowLimit = testResult?.lowLimit ?? TEST_LOW_LIMIT;
    const highLimit = testResult?.highLimit ?? TEST_HIGH_LIMIT;
    const unit = testResult?.unit ?? TEST_UNIT;
    const site = siteBySite.get(r.device.site);
    const binCause =
      BIN_CAUSE_HINTS[r.device.softBin] ?? "尚無對照的失敗原因說明，需要工程師補充 bin definition";

    const limitReason =
      value > highLimit
        ? `量測值 ${value.toFixed(3)} ${unit}，超出 High Limit ${highLimit} ${unit} 達 ${(value - highLimit).toFixed(3)}`
        : `量測值 ${value.toFixed(3)} ${unit}，低於 Low Limit ${lowLimit} ${unit} 達 ${(lowLimit - value).toFixed(3)}`;

    const reasons = [limitReason, binCause];
    if (site?.isAnomalous) {
      reasons.push(
        `Site ${r.device.site} 整體平均值偏離其他 site（${site.anomalyReason}），此 device 的失敗可能與 site 系統性問題有關，而非單一 device 本身的缺陷`,
      );
    }

    return {
      pid: r.device.pid,
      site: r.device.site,
      testSuiteName: r.results[0]?.testSuiteName ?? TEST_SUITE_NAME,
      value,
      softBin: r.device.softBin,
      binLabel: SOFT_BIN_LABELS[r.device.softBin] ?? `Bin ${r.device.softBin}`,
      summary: site?.isAnomalous
        ? `疑似 Site ${r.device.site} 系統性問題（site imbalance），建議優先排查 site 而非單一 device`
        : binCause,
      reasons,
    };
  });
}

// ---------------------------------------------------------------------------
// 場景二：IC 溫度預測 + 通知機台軟體（官方題目原文的第二個場景）
//
// 目前完全是 demo 架構：用「漏電流（IDDQ）數值越高、推估接面溫度越高」這個
// 半導體物理上合理但被我簡化成線性關係的假設，把 site 的量測值換算成一個
// 「預測溫度」。這不是真正的溫度感測或 ML 模型，只是先把 UI/資料流程搭出來，
// 等拿到真實 CSV 資料集後，要整個換成真正的預測邏輯。見 Notion 對齊表。
// ---------------------------------------------------------------------------

const AMBIENT_TEMP_C = 25; // demo 用室溫基準
const TEMP_SENSITIVITY_C_PER_MA = 7.5; // demo 用：每超出 baseline 電流 1 mA，推估溫度上升幾度
const NOTIFY_TEMP_THRESHOLD_C = 85; // demo 用通知門檻，真實門檻需與工程師/機台規格確認

export function generateTemperatureSnapshot(): TemperatureSnapshot {
  const results = generateMockResults();
  const siteSummaries = summarizeBySite(results);

  const predictions: TemperaturePrediction[] = siteSummaries.map((s) => {
    const predictedTempC = AMBIENT_TEMP_C + (s.mean - 19.5) * TEMP_SENSITIVITY_C_PER_MA;
    const shouldNotify = predictedTempC >= NOTIFY_TEMP_THRESHOLD_C;

    return {
      site: s.site,
      predictedTempC: Number(predictedTempC.toFixed(1)),
      thresholdC: NOTIFY_TEMP_THRESHOLD_C,
      shouldNotify,
      confidence: shouldNotify ? 0.72 : 0.88,
      predictedAt: new Date().toISOString(),
      basis: [
        `依 Site ${s.site} 的 ${TEST_SUITE_NAME} 平均量測值 ${s.mean} ${TEST_UNIT} 推估（demo 用線性關係：量測值每偏離 baseline 1 ${TEST_UNIT}，溫度預估 +${TEMP_SENSITIVITY_C_PER_MA}°C，非真正的溫度感測或訓練過的模型）`,
      ],
    };
  });

  const notifications: MachineNotification[] = predictions
    .filter((p) => p.shouldNotify)
    .map((p) => ({
      id: `notify-site-${p.site}`,
      site: p.site,
      predictedTempC: p.predictedTempC,
      action: `建議降低 Site ${p.site} 測試速度或暫停該 site，待溫度回落至 ${NOTIFY_TEMP_THRESHOLD_C}°C 以下`,
      sentAt: new Date().toISOString(),
      status: "SENT",
    }));

  return {
    generatedAt: new Date().toISOString(),
    predictions,
    notifications,
  };
}
