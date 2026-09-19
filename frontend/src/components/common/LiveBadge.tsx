import { C, MONO } from "@/lib/theme";

export function LiveBadge({ tick, live = true }: { tick: number; live?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: 100,
        background: live ? C.greenBg : C.surfaceVariant,
        border: `1px solid ${live ? C.greenBorder : C.border}`,
      }}
    >
      <span
        className={live ? "pulse-dot" : undefined}
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: live ? C.greenDot : C.dim,
          display: "block",
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", color: live ? C.green : C.muted, fontFamily: MONO }}>
        {live ? "LIVE" : "OFFLINE"}
      </span>
      <span style={{ fontSize: 12, color: C.dim, fontFamily: MONO }}>#{tick}</span>
    </div>
  );
}
