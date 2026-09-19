import type { TemperaturePrediction } from "@/lib/api";
import { C, MONO } from "@/lib/theme";

export function ThermalCard({ prediction }: { prediction: TemperaturePrediction }) {
  const overThreshold = prediction.predictedTempC >= prediction.thresholdC;
  const nearThreshold = prediction.predictedTempC >= prediction.thresholdC - 5;
  const statusColor = overThreshold ? C.red : nearThreshold ? C.yellow : C.green;
  const statusBg = overThreshold ? C.redBg : nearThreshold ? C.yellowBg : C.greenBg;
  const statusBorder = overThreshold ? C.redBorder : nearThreshold ? C.yellowBorder : C.greenBorder;
  const pct = Math.min(100, (prediction.predictedTempC / prediction.thresholdC) * 100);

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${overThreshold ? C.redBorder : C.border}`,
        borderRadius: 12,
        padding: "18px 20px",
        boxShadow: overThreshold ? `${C.shadowMd}, 0 0 0 1px ${C.redBorder}` : C.shadow,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: C.muted }}>SITE {prediction.site}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 100, background: statusBg, border: `1px solid ${statusBorder}` }}>
          {overThreshold && <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: C.red, display: "block", flexShrink: 0 }} />}
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: statusColor }}>
            {overThreshold ? "OVER LIMIT" : nearThreshold ? "WARNING" : "NORMAL"}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 42, lineHeight: 1, color: statusColor }}>
          {prediction.predictedTempC.toFixed(1)}
          <span style={{ fontSize: 16, color: C.muted, fontWeight: 400 }}>°C</span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Predicted Temperature</div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ height: 6, borderRadius: 3, background: C.borderLight, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: overThreshold ? C.red : nearThreshold ? "#D97706" : C.green, borderRadius: 3, transition: "width 0.5s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontFamily: MONO, fontSize: 11, color: C.muted }}>
          <span>0°C</span>
          <span>Threshold: {prediction.thresholdC}°C</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 12, borderTop: `1px solid ${C.borderLight}` }}>
        {[
          { label: "THRESHOLD", val: `${prediction.thresholdC}°C` },
          { label: "CONFIDENCE", val: `${(prediction.confidence * 100).toFixed(0)}%` },
        ].map(({ label, val }) => (
          <div key={label}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C.text }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
