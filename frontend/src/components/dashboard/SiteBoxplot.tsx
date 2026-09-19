import type { SiteSummary } from "@/lib/api";
import { C, MONO, siteStatus, estimateBoxplotDist } from "@/lib/theme";

export function SiteBoxplot({ sites }: { sites: SiteSummary[] }) {
  const W = 520;
  const H = 160;
  const pad = 40;
  const slotW = (W - pad * 2) / Math.max(sites.length, 1);
  // 優先用後端/mock 算出來的真正五數彙總（boxplot），只有在資料不足以算出
  // 分位數時才退回常態分布近似值。
  const dists = sites.map((s) => s.boxplot ?? estimateBoxplotDist(s.mean, s.stdDev));
  const allVals = dists.flat();
  const minV = Math.min(...allVals) - 1;
  const maxV = Math.max(...allVals) + 1;
  const sy = (v: number) => pad + ((maxV - v) / (maxV - minV)) * (H - pad * 2);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: MONO }}>
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke={C.border} strokeWidth={1} />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const v = minV + t * (maxV - minV);
        const y = sy(v);
        return (
          <g key={t}>
            <line x1={pad} y1={y} x2={W - pad} y2={y} stroke={C.borderLight} strokeWidth={1} />
            <text x={pad - 5} y={y + 3} textAnchor="end" fontSize={9} fill={C.muted}>
              {v.toFixed(1)}
            </text>
          </g>
        );
      })}
      {sites.map((s, i) => {
        const [vmin, q1, med, q3, vmax] = dists[i];
        const cx = pad + slotW * i + slotW / 2;
        const bw = slotW * 0.4;
        const status = siteStatus(s.passRate, s.isAnomalous);
        const col = status === "normal" ? C.green : status === "warning" ? "#D97706" : C.red;
        return (
          <g key={s.site}>
            <line x1={cx} y1={sy(vmin)} x2={cx} y2={sy(vmax)} stroke={col} strokeWidth={1} opacity={0.4} />
            <line x1={cx - 8} y1={sy(vmin)} x2={cx + 8} y2={sy(vmin)} stroke={col} strokeWidth={1.5} />
            <line x1={cx - 8} y1={sy(vmax)} x2={cx + 8} y2={sy(vmax)} stroke={col} strokeWidth={1.5} />
            <rect
              x={cx - bw / 2}
              y={sy(q3)}
              width={bw}
              height={Math.abs(sy(q1) - sy(q3))}
              fill={col}
              opacity={0.12}
              stroke={col}
              strokeWidth={1.5}
              rx={2}
            />
            <line x1={cx - bw / 2} y1={sy(med)} x2={cx + bw / 2} y2={sy(med)} stroke={col} strokeWidth={2.5} />
            <text x={cx} y={H - 4} textAnchor="middle" fontSize={10} fill={col} fontWeight={500}>
              Site {s.site}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
