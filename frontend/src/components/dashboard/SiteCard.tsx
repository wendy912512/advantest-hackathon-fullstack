import type { SiteSummary } from "@/lib/api";
import { C, MONO, siteStatus } from "@/lib/theme";
import { StatusDot } from "@/components/common/StatusDot";

export function SiteCard({ site, onClick }: { site: SiteSummary; onClick: () => void }) {
  const status = siteStatus(site.passRate, site.isAnomalous);
  const isError = status === "error";
  const isWarn = status === "warning";
  const passRatePct = site.passRate * 100;

  return (
    <button
      onClick={onClick}
      className="text-left w-full transition-all duration-150 hover:shadow-md"
      style={{
        background: C.card,
        border: `1px solid ${isError ? C.redBorder : isWarn ? C.yellowBorder : C.border}`,
        borderRadius: 12,
        padding: "16px 18px",
        cursor: "pointer",
        boxShadow: isError ? `${C.shadowMd}, 0 0 0 1px ${C.redBorder}` : C.shadow,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: C.muted }}>SITE {site.site}</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 10px",
            borderRadius: 100,
            background: isError ? C.redBg : isWarn ? C.yellowBg : C.greenBg,
            border: `1px solid ${isError ? C.redBorder : isWarn ? C.yellowBorder : C.greenBorder}`,
          }}
        >
          <StatusDot status={status} size={6} />
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: isError ? C.red : isWarn ? C.yellow : C.green }}>
            {status.toUpperCase()}
          </span>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 40, lineHeight: 1, color: passRatePct >= 80 ? C.text : passRatePct >= 70 ? "#B45309" : C.red }}>
          {passRatePct.toFixed(1)}
          <span style={{ fontSize: 18, color: C.muted, fontWeight: 400 }}>%</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 12, marginTop: 4, color: C.muted }}>Pass Rate</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 12, borderTop: `1px solid ${C.borderLight}` }}>
        {[
          { label: "MEAN", val: site.mean.toFixed(3) },
          { label: "STDEV", val: site.stdDev.toFixed(3) },
        ].map(({ label, val }) => (
          <div key={label}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginBottom: 3, letterSpacing: "0.06em" }}>{label}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: C.sub }}>{val}</div>
          </div>
        ))}
      </div>
      {site.anomalyReason && (
        <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: C.redBg, border: `1px solid ${C.redBorder}`, fontSize: 12, fontFamily: MONO, color: C.red }}>
          {site.anomalyReason}
        </div>
      )}
    </button>
  );
}
