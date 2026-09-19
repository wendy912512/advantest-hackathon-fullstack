"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SiteSummary } from "@/lib/api";
import { C, MONO, siteStatus, type SiteStatus } from "@/lib/theme";
import { StatusDot } from "./StatusDot";
import { LiveBadge } from "./LiveBadge";

export function Header({
  sites,
  tick,
  lastUpdate,
  lot,
  wafer,
  live = true,
}: {
  sites: SiteSummary[];
  tick: number;
  lastUpdate: string;
  lot: string;
  wafer: string;
  live?: boolean;
}) {
  const pathname = usePathname();
  const onThermal = pathname === "/temperature";

  const systemStatus: SiteStatus = sites.some((s) => siteStatus(s.passRate, s.isAnomalous) === "error")
    ? "error"
    : sites.some((s) => siteStatus(s.passRate, s.isAnomalous) === "warning")
      ? "warning"
      : "normal";
  const statusColor = systemStatus === "error" ? C.red : systemStatus === "warning" ? C.yellow : C.green;
  const statusBg = systemStatus === "error" ? C.redBg : systemStatus === "warning" ? C.yellowBg : C.greenBg;
  const statusBorder = systemStatus === "error" ? C.redBorder : systemStatus === "warning" ? C.yellowBorder : C.greenBorder;

  return (
    <div
      className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-5"
      style={{ background: C.card, borderBottom: `1px solid ${C.border}`, height: 56, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", flexShrink: 0 }}
    >
      <Link href="/" className="flex items-center gap-2.5 shrink-0" style={{ textDecoration: "none" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: MONO, color: "#fff", fontSize: 11, fontWeight: 700 }}>CP</span>
        </div>
        <span style={{ fontSize: 18, fontWeight: 500, color: C.text }}>CP Monitor</span>
      </Link>

      {onThermal ? (
        <>
          <span style={{ color: C.dim, fontSize: 20, lineHeight: 1 }}>/</span>
          <span style={{ fontSize: 16, fontWeight: 500, color: C.text }}>IC Thermal</span>
        </>
      ) : (
        <>
          <div className="hidden sm:block" style={{ width: 1, height: 20, background: C.border, marginInline: 4 }} />
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: C.surfaceVariant }}>
            <span style={{ fontSize: 11, color: C.muted }}>LOT</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: MONO }}>{lot}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: C.surfaceVariant }}>
            <span style={{ fontSize: 11, color: C.muted }}>WAFER</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: MONO }}>{wafer}</span>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{ background: statusBg, border: `1px solid ${statusBorder}` }}
          >
            <StatusDot status={systemStatus} size={7} />
            <span className="hidden sm:inline" style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>
              {systemStatus === "normal" ? "NORMAL" : systemStatus === "warning" ? "WARNING" : "ANOMALY DETECTED"}
            </span>
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden md:block" style={{ fontSize: 13, color: C.muted }}>
          Updated <span style={{ fontWeight: 500, color: C.sub }}>{lastUpdate}</span>
        </span>
        <LiveBadge tick={tick} live={live} />
      </div>
    </div>
  );
}
