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
// 注意（未經證實的推論，非文件明載）：實際觀察到的 log 是 FT（Final Test，
// 封裝後測試，TestStepCode=FT）情境，完全沒有 WAFERSTART/WAFEREND 事件，直接
// LOTSTART → TESTSTART → ... → TESTEND → LOTEND。ONEAPI 官方文件本身並未說明
// WAFERSTART/WAFEREND 只出現在哪種情境，這裡只是從「FT 沒有」反推「可能是 CP
// 專屬」，尚未經任何文件或工程師證實。本專案的 site/wafer map 相關功能是假設
// CP 情境設計的（wafer 是必要欄位），如果這次黑客松實際測的是像這份 log 一樣
// 的 FT，wafer 欄位與 Wafer Map 頁面在概念上就不成立，需要重新設計。串接真實
// 後端前務必跟工程師/主辦方確認這次實際測的是 CP 還是 FT，見 Notion 對齊表。

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

// Lot 是一批貨的單位，底下包含多片 wafer（CP 情境下通常一批 25 片，demo 用少一點）。
// 依實務工作流程（見 Notion 對齊表的品控回饋）：封裝前看的是「整批 Lot」的彙總品質，
// 不是逐片 wafer 互相比較；wafer 之間的比較只在需要 drill-down 排查時才用。
export interface LotListItem {
  lot: string;
  waferCount: number;
  totalDevices: number;
  passRate: number;
  hasIssue: boolean;
  startedAt: string; // ISO timestamp
}

export interface WaferListItem {
  wafer: string;
  totalDevices: number;
  passRate: number;
  hasIssue: boolean;
}

export interface LotSummary {
  lot: string;
  waferCount: number;
  totalDevices: number;
  passRate: number;
  siteSummaries: SiteSummary[];
  softBinBreakdown: BinBreakdown[];
  hardBinBreakdown: BinBreakdown[];
  suspectIssues: string[];
  wafers: WaferListItem[]; // 供 drill-down 選片用，不是比較表
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
