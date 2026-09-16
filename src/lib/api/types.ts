// 依據 ONEAPI / ACS RTDI 資料格式定義的型別（DeviceInfo + Device test results）

export type PassFail = "PASS" | "FAIL";

export interface DeviceInfo {
  pid: string;
  lot: string;
  wafer: string;
  site: number;
  x: number;
  y: number;
  pf: PassFail;
  softBin: number;
  hardBin: number;
  testTime: string; // ISO timestamp
}

export type TestKind = "FUNCTIONAL" | "PARAMETRIC" | "MULTI_PARAM" | "SCAN";

export interface TestResultField {
  testNumber: number;
  testSuiteName: string;
  pinName?: string;
  kind: TestKind;
  value?: number; // parametric / multi-param
  pass: boolean; // functional / scan
}

export interface DeviceTestResult {
  device: DeviceInfo;
  results: TestResultField[];
}

export interface SiteSummary {
  site: number;
  count: number;
  passRate: number; // 0-1
  mean: number;
  stdDev: number;
  isAnomalous: boolean;
  anomalyReason?: string;
}

export interface BinBreakdown {
  bin: number;
  label: string;
  count: number;
  ratio: number; // 0-1
}

export interface LotSummary {
  lot: string;
  wafer: string;
  totalDevices: number;
  passRate: number;
  siteSummaries: SiteSummary[];
  softBinBreakdown: BinBreakdown[];
  hardBinBreakdown: BinBreakdown[];
  suspectIssues: string[];
}

export type TrendDirection = "UP" | "DOWN" | "STABLE" | "SHIFT";

export interface TrendAlert {
  id: string;
  site: number;
  testSuiteName: string;
  direction: TrendDirection;
  detectedAt: string;
  message: string;
}

export interface TrendPoint {
  timestamp: string; // ISO
  value: number;
}

export interface TrendSeries {
  site: number;
  testSuiteName: string;
  points: TrendPoint[];
  baselineMean: number;
  baselineStdDev: number;
  ucl: number; // baselineMean + 3 * baselineStdDev
  lcl: number; // baselineMean - 3 * baselineStdDev
  alerts: TrendAlert[];
}

export interface WaferPoint {
  pid: string;
  x: number;
  y: number;
  pf: PassFail;
  softBin: number;
}

export interface WaferMapData {
  lot: string;
  wafer: string;
  radius: number;
  points: WaferPoint[];
}

export interface FailureExplanation {
  pid: string;
  site: number;
  testSuiteName: string;
  value: number;
  softBin: number;
  binLabel: string;
  summary: string;
  reasons: string[];
}

export interface DashboardSnapshot {
  generatedAt: string;
  currentLot: string;
  currentWafer: string;
  totalDevicesTested: number;
  overallPassRate: number;
  siteSummaries: SiteSummary[];
  trendAlerts: TrendAlert[];
  recentResults: DeviceTestResult[];
}
