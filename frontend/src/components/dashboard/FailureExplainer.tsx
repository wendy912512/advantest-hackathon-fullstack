import type { FailureExplanation } from "@/lib/api";
import { C, MONO } from "@/lib/theme";

export function FailureExplainer({ failures }: { failures: FailureExplanation[] }) {
  return (
    <div>
      {failures.map((f) => (
        <div key={f.pid} style={{ border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 8, overflow: "hidden", boxShadow: C.shadow }}>
          <div style={{ padding: "12px 16px", background: C.card, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.text }}>{f.pid}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, padding: "2px 10px", borderRadius: 100, background: C.surfaceVariant, color: C.muted }}>Site {f.site}</span>
              <span style={{ fontSize: 13, color: C.muted }}>{f.testSuiteName}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C.red }}>{f.value.toFixed(2)}</span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  padding: "2px 10px",
                  borderRadius: 100,
                  fontWeight: 600,
                  background: C.redBg,
                  color: C.red,
                  marginLeft: "auto",
                }}
              >
                {f.binLabel}
              </span>
            </div>
          </div>
          <div style={{ background: C.surface, padding: "10px 16px" }}>
            <div style={{ fontSize: 13, lineHeight: 1.6, padding: "10px 14px", borderRadius: 8, background: C.card, border: `1px solid ${C.border}`, color: C.sub }}>
              {f.summary}
            </div>
            {f.reasons.length > 1 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
                {f.reasons.slice(1).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
      {failures.length === 0 && <div style={{ textAlign: "center", padding: "32px 16px", color: C.muted, fontSize: 14 }}>目前沒有失敗紀錄</div>}
    </div>
  );
}
