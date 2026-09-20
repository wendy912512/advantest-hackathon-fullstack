"use client";

import { useEffect, useMemo, useState } from "react";
import type { ThermalValidationMetrics, ThermalValidationReport } from "@/lib/api";
import { C, MONO } from "@/lib/theme";
import { SectionHeader } from "@/components/common/SectionHeader";

function formatMetric(value: number | null | undefined, digits = 4) {
  return value == null ? "—" : value.toFixed(digits);
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 14px", boxShadow: C.shadow }}>
      <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: color ?? C.text }}>{value}</div>
    </div>
  );
}

function SensorRows({ rows }: { rows: ThermalValidationMetrics[] }) {
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 10, background: C.card }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 830, fontSize: 12 }}>
        <thead>
          <tr style={{ background: C.surface }}>
            {['Sensor', '樣本數', 'MAE (°C)', 'RMSE (°C)', '準確率', '成功', '誤報', '漏報', '正常吻合'].map((label) => (
              <th key={label} style={{ padding: "10px 12px", textAlign: label === "Sensor" ? "left" : "right", color: C.muted, fontFamily: MONO, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.index} style={{ borderTop: `1px solid ${C.borderLight}` }}>
              <td style={{ padding: "10px 12px", color: C.sub, fontFamily: MONO, fontWeight: 600 }}>{item.name}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: MONO }}>{item.samples}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: MONO }}>{formatMetric(item.mae)}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: MONO }}>{formatMetric(item.rmse)}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: MONO, color: (item.accuracy ?? 1) < 0.98 ? C.red : C.green }}>{item.accuracy == null ? "—" : `${(item.accuracy * 100).toFixed(2)}%`}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: MONO, color: item.hit ? C.green : C.muted }}>{item.hit}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: MONO, color: item.falseAlarm ? C.yellow : C.muted }}>{item.falseAlarm}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: MONO, color: item.miss ? C.red : C.muted }}>{item.miss}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: MONO }}>{item.ok}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ThermalValidationReportView({ report }: { report: ThermalValidationReport }) {
  const wafers = useMemo(() => Object.keys(report.waferFolds).sort(), [report.waferFolds]);
  const [selectedWafer, setSelectedWafer] = useState(wafers[0] ?? "");
  const sensors = useMemo(() => Object.values(report.sensorSummary).sort((a, b) => a.index - b.index), [report.sensorSummary]);
  const selectedFold = report.waferFolds[selectedWafer];
  const foldRows = selectedFold ? Object.values(selectedFold).sort((a, b) => a.index - b.index) : [];

  useEffect(() => {
    if (!wafers.includes(selectedWafer)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 報告檔更新後同步回第一片有效 wafer。
      setSelectedWafer(wafers[0] ?? "");
    }
  }, [wafers, selectedWafer]);

  return (
    <div>
      <SectionHeader id="thermal-validation" label="模型驗證報告" />
      {report.status === "stale" && report.productionModel && (
        <div style={{ border: `1px solid ${C.yellow}`, borderRadius: 10, padding: "10px 12px", background: "#fff8e1", color: C.sub, fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
          目前報告仍是舊的 Ridge baseline 結果；實際部署模型已是 <strong>{report.productionModel.name}</strong>。請重新執行 LightGBM 驗證腳本後再把報告檔更新，以下數值不可視為新版模型成績。
        </div>
      )}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, background: C.card, boxShadow: C.shadow, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <div style={{ color: C.text, fontFamily: MONO, fontWeight: 700, fontSize: 14 }}>{report.config.model}</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Leave-One-Wafer-Out：每一折皆排除目標 wafer，不將驗證 wafer 混入訓練。</div>
            {report.productionModel && <div style={{ color: C.blue, fontFamily: MONO, fontSize: 11, marginTop: 6 }}>目前部署：{report.productionModel.name} · {report.productionModel.featureSchema}</div>}
          </div>
          <div style={{ color: C.muted, fontFamily: MONO, fontSize: 11 }}>產生時間 {new Date(report.generatedAt).toLocaleString("zh-TW", { hour12: false })}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8 }}>
          <MetricCard label="訓練 WAFER" value={`${report.dataset.trainingWafers.length} 片`} />
          <MetricCard label="訓練 DEVICE" value={`${report.dataset.trainingDevices.toLocaleString()} 顆`} />
          <MetricCard label="驗證預測" value={`${report.overall.samples.toLocaleString()} 筆`} />
          <MetricCard label="整體 MAE" value={`${formatMetric(report.overall.mae)}°C`} color={C.blue} />
          <MetricCard label="整體 RMSE" value={`${formatMetric(report.overall.rmse)}°C`} color={C.blue} />
          <MetricCard label="告警分類準確率" value={report.overall.accuracy == null ? "—" : `${(report.overall.accuracy * 100).toFixed(2)}%`} color={C.green} />
        </div>
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: C.surface, color: C.sub, fontSize: 12, lineHeight: 1.6 }}>
          新 wafer 評估：<strong>{report.newWaferEvaluation.status}</strong>。{report.newWaferEvaluation.note}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <SectionHeader id="thermal-validation-sensors" label="各 Sensor 驗證結果" count={sensors.length} />
        <SensorRows rows={sensors} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <SectionHeader id="thermal-validation-wafer" label="單片 Wafer Leave-One-Wafer-Out 結果" />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {wafers.map((wafer) => {
            const active = wafer === selectedWafer;
            return (
              <button key={wafer} type="button" onClick={() => setSelectedWafer(wafer)} style={{ border: `1px solid ${active ? C.blue : C.border}`, borderRadius: 8, padding: "5px 10px", background: active ? C.blueBg : C.card, color: active ? C.blue : C.sub, cursor: "pointer", fontFamily: MONO, fontSize: 12, fontWeight: active ? 700 : 400 }}>
                {wafer}
              </button>
            );
          })}
        </div>
        <SensorRows rows={foldRows} />
      </div>
    </div>
  );
}
