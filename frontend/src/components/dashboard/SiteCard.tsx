import { C, MONO, siteStatus } from "@/lib/theme";
import { StatusDot } from "@/components/common/StatusDot";

// 歷史 lot/wafer（非目前即時監控）只有 pass/fail per die，沒有原始量測值，
// 算不出 mean/stdDev/boxplot——所以這裡故意比 SiteSummary 型別更寬鬆，
// mean/stdDev/isAnomalous 都是可選的，缺席時卡片會少顯示那兩格數字，而不
// 是硬塞假數字進去。
export interface SiteCardData {
  site: number;
  passRate: number;
  failDeviceCount?: number;
  count?: number;
  mean?: number;
  stdDev?: number;
  isAnomalous?: boolean;
  anomalyReason?: string;
}

export function SiteCard({ site, selected, onClick }: { site: SiteCardData; selected?: boolean; onClick: () => void }) {
  const status = siteStatus(site.passRate, site.isAnomalous, site.failDeviceCount);
  const isError = status === "error";
  const isWarn = status === "warning";
  const passRatePct = site.passRate * 100;
  const hasStats = site.mean !== undefined && site.stdDev !== undefined;

  return (
    <button
      onClick={onClick}
      className="text-left w-full transition-all duration-150 hover:shadow-md"
      style={{
        background: C.card,
        // 外框只表示目前選取的 Site；錯誤/警告狀態由右上角 badge 表示，避免
        // 紅色外框和藍色選取外框產生視覺混淆。
        border: `1px solid ${selected ? C.blue : C.border}`,
        borderRadius: 12,
        padding: "16px 18px",
        cursor: "pointer",
        boxShadow: selected
          ? `${C.shadowMd}, 0 0 0 2px ${C.blue}`
          : C.shadow,
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
        {hasStats ? (
          <>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginBottom: 3, letterSpacing: "0.06em" }}>MEAN</div>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: C.sub }}>{site.mean!.toFixed(3)}</div>
            </div>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginBottom: 3, letterSpacing: "0.06em" }}>STDEV</div>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: C.sub }}>{site.stdDev!.toFixed(3)}</div>
            </div>
          </>
        ) : (
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginBottom: 3, letterSpacing: "0.06em" }}>DEVICES</div>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: C.sub }}>{site.count ?? "—"}</div>
          </div>
        )}
      </div>
      {(site.failDeviceCount ?? 0) > 0 && (
        <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 11, color: C.red }}>
          DEVICE FAIL：{site.failDeviceCount}
        </div>
      )}
    </button>
  );
}
