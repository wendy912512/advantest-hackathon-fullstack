// 依據 ONEAPI / ACS RTDI 資料格式定義的型別（DeviceInfo + Device test results）
//
// ONEAPI 是事件驅動架構：consumeData() 會依序收到 DATA_TYP_PRODUCTION_TESTEND
// （每個 site 的 bin/Part ID/座標/測試時間）與 DATA_TYP_MEASURED_PARAMETRIC
// （實際量測值）等「不同的事件」，兩者不是同一筆資料。DeviceTestResult 把它們
// 合併成一筆，是前端呈現用的 view model；後端需要用 lot+wafer+site+test 當 key
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
  failDeviceCount?: number;
  mean: number;
  stdDev: number;
  isAnomalous: boolean;
  anomalyReason?: string;
  // [min, Q1, median, Q3, max]，來自該 site 全部原始量測值算出來的真正五數
  // 彙總，不是用 mean/stdDev 假設常態分布反推的近似值。後端資料不足（少於
  // 2 筆量測值）時可能缺席，此時 UI 端會 fallback 回 estimateBoxplotDist()
  // 這個近似算法，見 src/lib/theme.ts。
  boxplot?: [number, number, number, number, number];
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
  wafer?: string; // CSV-backed trend aggregation key, absent for legacy live events
  pid?: string;
  sequence?: number;
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
  // 這片 wafer 上這顆 device 屬於哪個 site。有這個欄位才能在「Sites」頁面
  // 選一個歷史 lot/wafer 時，把這片 wafer 的 device 依 site 分組算出各 site
  // 的 pass rate——沒有原始量測值，所以歷史 wafer 只能算 pass rate，算不出
  // mean/stdDev/boxplot（那些只有「目前正在測試中」的即時資料才有）。
  site: number;
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

// 場景二：在「下一個 sensor 測試執行前」，對整片 wafer 的每個 device 分別預測
// 該 sensor 的值，預測會超標就立即通知；實測完成後回填實際值、誤差與判定
// （預測成功 / 誤報 / 漏報）。不是等 80 個 device 測完才分析。
// 真實資料形狀見 backend/app/thermal.py 與 A12345_W01_RawResult.csv。
export type ThermalStatus = "normal" | "warning" | "critical" | "pending";
export type ThermalVerdict = "hit" | "false_alarm" | "miss" | "ok";
// verified：已實測；next：正要預測的下一個 sensor；future：還沒輪到，不預測
export type SensorStage = "verified" | "next" | "future";

export interface ThermalSensorMeta {
  index: number;
  name: string; // 如 160_Main.sensor4#IO1
  testNumber: number;
  upperLimit: number | null;
  warnThreshold: number | null;
  unit: string;
  stage: SensorStage;
}

export interface DeviceSensorPrediction {
  sensor: number;
  predicted: number | null;
  actual: number | null; // 只有 stage=verified 才有
  error: number | null; // actual - predicted
  status: ThermalStatus; // 預測狀態
  verdict: ThermalVerdict | null; // 實測回來後才有
}

export interface DeviceThermal {
  pid: string;
  site: number;
  x: number;
  y: number;
  sensors: DeviceSensorPrediction[];
}

export interface WaferThermal {
  lot: string;
  wafer: string;
  isLive: boolean;
  generatedAt: string;
  completedSensors: number;
  nextSensor: number | null;
  sensors: ThermalSensorMeta[];
  devices: DeviceThermal[];
}

// Sites 頁 Table：只列 Fail 異常資料。每列是「一顆 fail device 的一個超標事件」
// （event 為 null 表示只有 SBin/HBin 判定失敗、沒有對應的超標測項）。
// 事件（約 3000 個測項）只有超出上下限的才會出現在 events 下拉選單。
export interface FailRow {
  pid: string;
  site: number;
  x: number;
  y: number;
  softBin: number;
  softBinLabel: string;
  hardBin: number;
  hardBinLabel: string;
  event: string | null; // 如 220_Main.Suite1#CP
  meaning: string | null; // 事件涵義；只有名稱本身有明確依據的（sensorN、IDDQ）才有，其餘為 null
  value: number | null;
  lowLimit: number | null;
  highLimit: number | null;
}

export interface FailEventOption {
  event: string;
  meaning: string | null;
  count: number;
}

export interface WaferFails {
  lot: string;
  wafer: string;
  events: FailEventOption[];
  rows: FailRow[];
}

export interface DistributionEvent {
  event: string;
  testSuiteName: string;
  pinName: string | null;
  unit: string | null;
  lowLimit: number | null;
  highLimit: number | null;
  count: number;
}

export interface DistributionSample {
  pid: string;
  site: number;
  value: number;
  pass: boolean;
  probability: number;
}

export interface WaferDistribution {
  lot: string;
  wafer: string;
  events: DistributionEvent[];
  selectedEvent: string | null;
  unit?: string | null;
  lowLimit?: number | null;
  highLimit?: number | null;
  samples: DistributionSample[];
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
