"use client";

import { useEffect, useState } from "react";
import type { DeviceTestResult, SiteSummary } from "@/lib/api";
import { fetchSiteResults } from "@/lib/api";
import { C, MONO } from "@/lib/theme";
import { binLabel } from "@/lib/binLabels";
import { SiteBoxplot } from "./SiteBoxplot";

export function SiteDrawer({
  site,
  allSites,
  onClose,
}: {
  site: SiteSummary | null;
  allSites: SiteSummary[];
  onClose: () => void;
}) {
  const open = site !== null;
  const [results, setResults] = useState<DeviceTestResult[]>([]);

  useEffect(() => {
    if (!site) return;
    let cancelled = false;
    fetchSiteResults(site.site).then((data) => {
      if (!cancelled) setResults(data.slice(0, 20));
    });
    return () => {
      cancelled = true;
    };
  }, [site]);

  return (
    <>
      {open && <div className="drawer-overlay" onClick={onClose} />}
      <div className={`drawer-panel ${open ? "" : "closed"}`}>
        {site && (
          <div style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                  Site Detail — IDDQ_A1
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 500, fontSize: 18, color: C.text }}>Site {site.site}</span>
                  <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, color: site.passRate >= 0.8 ? C.green : C.red }}>
                    {(site.passRate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  background: C.surface,
                  color: C.muted,
                  border: `1px solid ${C.border}`,
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                IDDQ_A1 Distribution — All Sites
              </div>
              <div style={{ background: C.surface, borderRadius: 8, padding: "12px 8px", border: `1px solid ${C.border}` }}>
                <SiteBoxplot sites={allSites} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                Latest Results — Site {site.site}
              </div>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", fontFamily: MONO, fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.surface }}>
                      {["PID", "Value", "Limits", "Bin"].map((h) => (
                        <th key={h} style={{ textAlign: h === "PID" ? "left" : "right", padding: "8px 12px", fontWeight: 500, color: C.muted, fontSize: 12 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => {
                      const result = r.results[0];
                      const pass = r.device.pf === "PASS";
                      return (
                        <tr key={r.device.pid} style={{ borderTop: `1px solid ${C.borderLight}` }}>
                          <td style={{ padding: "7px 12px", color: C.sub }}>{r.device.pid}</td>
                          <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: 500, color: pass ? C.text : C.red }}>
                            {result?.value?.toFixed(3) ?? "—"} {result?.unit ?? ""}
                          </td>
                          <td style={{ padding: "7px 12px", textAlign: "right", color: C.muted }}>
                            {result?.lowLimit ?? "—"}–{result?.highLimit ?? "—"}
                          </td>
                          <td style={{ padding: "7px 12px", textAlign: "right" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 100,
                                fontSize: 11,
                                fontWeight: 500,
                                background: pass ? C.greenBg : C.redBg,
                                color: pass ? C.green : C.red,
                              }}
                            >
                              {binLabel(r.device.softBin)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
