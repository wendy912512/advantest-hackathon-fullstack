import type { DashboardSnapshot, FailureExplanation, ThermalStatus, ThermalVerdict, TrendAlert, WaferThermal } from "@/lib/api";

export type AlertSeverity = "critical" | "warning";
export type AlertSource = "trend" | "thermal" | "failure";

// 統一的警告卡片格式，來源可能是 site 趨勢告警（TrendAlert）、溫度預測超過
// 門檻（TemperaturePrediction），或失敗 device 的原因說明（FailureExplanation，
// 原本獨立一個 Failure Explainer 區塊，現在整合進這裡的警告卡片，見使用者
// 「其他修正 1」的需求）。這個清單刻意「不分目前頁面選的是哪個 lot/wafer」
// ——右側警告欄要固定顯示系統目前所有異常，跟使用者在 Sites/Wafer Browser
// 頁面選的歷史 lot/wafer 篩選器是兩件事。
export interface UnifiedAlert {
  id: string;
  severity: AlertSeverity;
  source: AlertSource;
  site: number;
  lot: string;
  wafer: string;
  testItem: string;
  message: string;
  detectedAt: string;
  // 只有 source === "thermal" 才有：某個 device 的某個 sensor 預測。實測完成後
  // actual/error/verdict 會被回填，卡片從「預測異常」更新成驗證結果。
  thermal?: {
    pid: string;
    sensorName: string;
    status: ThermalStatus;
    predicted: number;
    upperLimit: number;
    unit: string;
    actual: number | null;
    error: number | null;
    verdict: ThermalVerdict | null;
  };
}

const MAX_THERMAL_ALERTS = 15;

// 預測時間要固定在「第一次預測出這筆異常」的時間點，不能每次輪詢都跟著後端的
// generatedAt 跳動，所以在模組層級記下第一次看到的時間（跨 render 保留）。
const firstSeen = new Map<string, string>();

function trendSeverity(alert: TrendAlert): AlertSeverity {
  return alert.direction === "SHIFT" ? "critical" : "warning";
}

export function buildUnifiedAlerts({
  dashboard,
  liveThermal,
  failures,
}: {
  dashboard: DashboardSnapshot | null;
  liveThermal: WaferThermal | null;
  failures: FailureExplanation[] | null;
}): UnifiedAlert[] {
  const alerts: UnifiedAlert[] = [];
  const lot = dashboard?.currentLot ?? "-";
  const wafer = dashboard?.currentWafer ?? "-";

  for (const alert of dashboard?.trendAlerts ?? []) {
    alerts.push({
      id: `trend-${alert.id}`,
      severity: trendSeverity(alert),
      source: "trend",
      site: alert.site,
      lot,
      wafer,
      testItem: alert.testSuiteName,
      message: alert.message,
      detectedAt: alert.detectedAt,
    });
  }

  const thermalAlerts: UnifiedAlert[] = [];
  if (liveThermal) {
    for (const meta of liveThermal.sensors) {
      if (meta.stage === "future" || meta.upperLimit === null) continue;
      for (const device of liveThermal.devices) {
        const p = device.sensors.find((s) => s.sensor === meta.index);
        if (!p || p.predicted === null) continue;
        const predictedAlarm = p.status === "warning" || p.status === "critical";
        const missed = p.verdict === "miss";
        if (!predictedAlarm && !missed) continue;

        const key = `${liveThermal.lot}/${liveThermal.wafer}/${device.pid}/${meta.index}`;
        if (!firstSeen.has(key)) firstSeen.set(key, new Date().toISOString());

        const actualCritical = p.actual !== null && p.actual >= meta.upperLimit;
        const severity: AlertSeverity = predictedAlarm ? (p.status === "critical" ? "critical" : "warning") : actualCritical ? "critical" : "warning";
        thermalAlerts.push({
          id: `thermal-${key}`,
          severity,
          source: "thermal",
          site: device.site,
          lot: liveThermal.lot,
          wafer: liveThermal.wafer,
          testItem: meta.name,
          // 重點是「預測會超標」而不是「已超標」：實測還沒完成前不能說已經超標；
          // 只有 Critical 才寫「會超標」，Warning 只是「接近上限」。
          message: p.status === "critical"
            ? `預測 ${p.predicted.toFixed(2)}${meta.unit} 會超過規格上限 ${meta.upperLimit}${meta.unit}`
            : p.status === "warning"
              ? `預測 ${p.predicted.toFixed(2)}${meta.unit} 接近規格上限 ${meta.upperLimit}${meta.unit}`
              : `預測正常，但實測 ${p.actual?.toFixed(2)}${meta.unit} 超出規格（漏報）`,
          detectedAt: firstSeen.get(key)!,
          thermal: {
            pid: device.pid,
            sensorName: meta.name,
            status: p.status,
            predicted: p.predicted,
            upperLimit: meta.upperLimit,
            unit: meta.unit,
            actual: p.actual,
            error: p.error,
            verdict: p.verdict,
          },
        });
      }
    }
  }
  // 卡片太多會淹沒右側欄：未驗證（正在等實測）且 critical 的優先，其餘依時間。
  thermalAlerts.sort((a, b) => {
    const rank = (x: UnifiedAlert) => (x.thermal?.actual === null ? 0 : 1) * 2 + (x.severity === "critical" ? 0 : 1);
    return rank(a) - rank(b);
  });
  alerts.push(...thermalAlerts.slice(0, MAX_THERMAL_ALERTS));
  if (thermalAlerts.length > MAX_THERMAL_ALERTS) {
    alerts.push({
      id: "thermal-overflow",
      severity: "warning",
      source: "thermal",
      site: 0,
      lot,
      wafer,
      testItem: "Thermal",
      message: `另有 ${thermalAlerts.length - MAX_THERMAL_ALERTS} 筆預測異常未顯示，請到 Thermal 頁查看完整矩陣`,
      detectedAt: new Date().toISOString(),
    });
  }

  for (const failure of failures ?? []) {
    alerts.push({
      id: `failure-${failure.pid}`,
      // 失敗 device 本身已經是確定發生的事實（不是趨勢預警），統一列為 warning，
      // 除非之後有更細的嚴重度分級需求。
      severity: "warning",
      source: "failure",
      site: failure.site,
      lot,
      wafer,
      testItem: failure.testSuiteName,
      message: `${failure.pid}（${failure.binLabel}）：${failure.summary}`,
      detectedAt: dashboard?.generatedAt ?? new Date().toISOString(),
    });
  }

  return alerts;
}
