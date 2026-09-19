"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { LotListItem, LotSummary, WaferListItem, WaferMapData } from "@/lib/api";
import { fetchLotSummary, fetchWaferMapData } from "@/lib/api";
import { C, MONO } from "@/lib/theme";
import { BIN_COLORS, binLabel } from "@/lib/binLabels";

function WaferThumb({ wafer, active, onClick }: { wafer: WaferListItem; active: boolean; onClick: () => void }) {
  const pr = wafer.passRate * 100;
  const dotColor = pr >= 90 ? C.green : pr >= 80 ? "#D97706" : C.red;
  return (
    <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          border: `2px solid ${active ? dotColor : wafer.hasIssue ? C.redBorder : C.border}`,
          background: active ? `${dotColor}1A` : C.card,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: active ? C.shadowMd : "none",
          transition: "all 0.15s",
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, color: dotColor }}>{Math.round(pr)}%</span>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{wafer.wafer}</span>
    </button>
  );
}

function WaferMap({ data, size = 280 }: { data: WaferMapData; size?: number }) {
  const scale = (size / 2 - 6) / data.radius;
  const center = size / 2;
  const toSvgX = (x: number) => center + x * scale;
  const toSvgY = (y: number) => center - y * scale;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: "#F0F0F0", border: `2px solid ${C.border}`, flexShrink: 0 }}>
      <svg width={size} height={size}>
        {data.points.map((p) => (
          <circle
            key={p.pid}
            cx={toSvgX(p.x)}
            cy={toSvgY(p.y)}
            r={p.pf === "FAIL" ? 3 : 2.4}
            fill={p.pf === "FAIL" ? BIN_COLORS[p.softBin] ?? C.red : BIN_COLORS[1]}
            opacity={p.pf === "FAIL" ? 0.85 : 0.55}
          />
        ))}
      </svg>
    </div>
  );
}

export function LotBrowser({ lots }: { lots: LotListItem[] }) {
  const [selectedLot, setSelectedLot] = useState<string | null>(lots[0]?.lot ?? null);
  const [summary, setSummary] = useState<LotSummary | undefined>(undefined);
  const [selectedWafer, setSelectedWafer] = useState<string | null>(null);
  const [waferMap, setWaferMap] = useState<WaferMapData | undefined>(undefined);

  useEffect(() => {
    if (!selectedLot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 取消選取時重置本地面板狀態，非 render 可推導值
      setSummary(undefined);
      return;
    }
    let cancelled = false;
    fetchLotSummary(selectedLot).then((data) => {
      if (!cancelled) {
        setSummary(data);
        setSelectedWafer(data?.wafers[0]?.wafer ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedLot]);

  useEffect(() => {
    if (!selectedLot || !selectedWafer) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 取消選取時重置本地面板狀態，非 render 可推導值
      setWaferMap(undefined);
      return;
    }
    let cancelled = false;
    fetchWaferMapData(selectedLot, selectedWafer).then((data) => {
      if (!cancelled) setWaferMap(data);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedLot, selectedWafer]);

  const binPareto = summary?.softBinBreakdown.map((b) => ({
    bin: b.label,
    count: b.count,
    fill: BIN_COLORS[b.bin] ?? "#9E9E9E",
  }));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
        {lots.map((lot) => {
          const active = selectedLot === lot.lot;
          const pr = lot.passRate * 100;
          return (
            <button
              key={lot.lot}
              onClick={() => setSelectedLot(active ? null : lot.lot)}
              style={{
                textAlign: "left",
                transition: "all 0.15s",
                background: active ? C.text : C.card,
                border: `1px solid ${active ? C.text : C.border}`,
                borderRadius: 12,
                padding: "14px 16px",
                cursor: "pointer",
                boxShadow: C.shadow,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: active ? "#9E9E9E" : C.muted }}>{lot.lot}</span>
                {lot.hasIssue && <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.red, display: "block" }} />}
              </div>
              <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 26, marginBottom: 4, color: active ? "#fff" : pr >= 85 ? C.text : "#B45309" }}>
                {pr.toFixed(1)}%
              </div>
              <div style={{ fontSize: 12, color: active ? "#9E9E9E" : C.muted }}>{lot.waferCount} wafers</div>
            </button>
          );
        })}
      </div>

      {summary && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, background: C.card, marginBottom: 12, boxShadow: C.shadow }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.borderLight}` }}>
            {[
              { label: "LOT ID", val: summary.lot, color: C.text },
              { label: "PASS RATE", val: `${(summary.passRate * 100).toFixed(1)}%`, color: C.text },
              { label: "WAFERS", val: `${summary.waferCount}`, color: C.text },
              { label: "ISSUE WAFERS", val: `${summary.wafers.filter((w) => w.hasIssue).length}`, color: C.red },
            ].map(({ label, val, color }) => (
              <div key={label}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color }}>{val}</div>
              </div>
            ))}
          </div>

          {summary.suspectIssues.length > 0 && (
            <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
              {summary.suspectIssues.map((issue) => (
                <div key={issue} style={{ fontSize: 12, color: C.red, background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "6px 10px" }}>
                  {issue}
                </div>
              ))}
            </div>
          )}

          {binPareto && binPareto.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: "0.06em", marginBottom: 8 }}>SOFT BIN PARETO</div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={binPareto} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis dataKey="bin" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.muted }} itemStyle={{ color: C.text }} />
                  <Bar dataKey="count" radius={3}>
                    {binPareto.map((e) => (
                      <Cell key={e.bin} fill={e.fill} opacity={0.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: "0.06em", marginBottom: 10 }}>WAFER GRID — CLICK TO INSPECT</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            {summary.wafers.map((w) => (
              <WaferThumb key={w.wafer} wafer={w} active={selectedWafer === w.wafer} onClick={() => setSelectedWafer(selectedWafer === w.wafer ? null : w.wafer)} />
            ))}
          </div>
        </div>
      )}

      {waferMap && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, background: C.card, boxShadow: C.shadow }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>WAFER</div>
              <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: C.text }}>{waferMap.wafer}</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              {Object.entries(BIN_COLORS).map(([bin, color]) => (
                <span key={bin} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.muted }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
                  {binLabel(Number(bin))}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <WaferMap data={waferMap} />
          </div>
        </div>
      )}
    </div>
  );
}
