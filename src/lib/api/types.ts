// 依據 ONEAPI / ACS RTDI 資料格式定義的型別（DeviceInfo + Device test results）
//
// ONEAPI 是事件驅動架構：consumeData() 會依序收到 DATA_TYP_PRODUCTION_TESTEND
// （每個 site 的 bin/Part ID/座標/測試時間）與 DATA_TYP_MEASURED_PARAMETRIC
// （實際量測值）等「不同的事件」，兩者不是同一筆資料。DeviceTestResult 把它們
// 合併成一筆，是為了前端/mock 方便；後端需要用 lot+wafer+site+test 當 key
// 暫存量測事件，等對應的 TESTEND 事件抵達再組裝輸出。詳見 Notion「後端建立指引」。
//
// 欄位對照真實 ONEAPI 回傳（依實際 py-app.log 觀察，ACS ONEAPI 3.3.0）：
//   DeviceInfo.softBin/hardBin  ← query_SBinResult / query_HBinResult（consumeTestEnd）
//   DeviceInfo.x/y              ← query_XCoord / query_YCoord（consumeTestEnd）
//   DeviceInfo.pid              ← query_PartId（consumeTestEnd）
//   DeviceInfo.testTime         ← query_TestTime（consumeTestEnd）
//   TestResultField.unit/lowLimit/highLimit ← query_Unit / query_LowLimit / query_HighLimit
//     （consumeParametricTest / consumeMultiParametric）
// 注意：實際觀察到的 log 是 FT（Final Test，封裝後測試，TestStepCode=FT）情境，
// 完全沒有 WAFERSTART/WAFEREND 事件，直接 LOTSTART → TESTSTART → ... → TESTEND →
// LOTEND；WAFERSTART/WAFEREND 應該只出現在 CP（wafer probe）情境。本專案的
// site/wafer map 相關功能是模擬 CP 情境設計的，串接真實後端時務必跟工程師確認
// 這次黑客松實際測試的是 CP 還是 FT，資料流程會不一樣。

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
  testTime: string; // ISO timestamp，對應 DATA_TYP_PRODUCTION_TESTEND
}

export type TestKind = "FUNCTIONAL" | "PARAMETRIC" | "MULTI_PARAM" | "SCAN";

export interface TestResultField {
  testNumber: number;
  testSuiteName: string;
  pinName?: string;
  kind: TestKind;
  value?: number; // parametric / multi-param，對應 DATA_TYP_MEASURED_PARAMETRIC / _MULTI_PARAM
  unit?: string; // 對應 query_Unit，如 "V"、"mA"
  lowLimit?: number; // 對應 query_LowLimit
  highLimit?: number; // 對應 query_HighLimit
  pass: boolean; // functional / scan，對應 DATA_TYP_MEASURED_FUNCTIONAL / _SCAN
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
