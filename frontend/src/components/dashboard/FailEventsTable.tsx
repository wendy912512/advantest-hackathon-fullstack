"use client";

import { useMemo, useState } from "react";
import type { FailRow } from "@/lib/api";
import { formatHardBin, formatSoftBin } from "@/lib/binLabels";
import { C, MONO } from "@/lib/theme";

const ALL = "__all__";

// 只呈現 Fail 異常資料。約 3000 個測項事件不會全部列出，只有「有 device 超出
// 上下限」的事件會出現在下拉選單，選一個事件就只看那個事件的 fail device。
// 事件為 null 的列代表「只有 SBin/HBin 判定失敗、沒有對應超標測項」，這種列的
// 事件編號/涵義不重複寫。事件涵義只在有明確依據時才顯示。
export function FailEventsTable({ rows, title }: { rows: FailRow[]; title: string }) {
  const [event, setEvent] = useState(ALL);

  const options = useMemo(() => {
    const map = new Map<string, { meaning: string | null; count: number }>();
    for (const r of rows) {
      if (!r.event) continue;
      const item = map.get(r.event) ?? { meaning: r.meaning, count: 0 };
      item.count += 1;
      map.set(r.event, item);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [rows]);

  const active = event === ALL || options.some(([e]) => e === event) ? event : ALL;
  const shown = active === ALL ? rows : rows.filter((r) => r.event === active);
  const showEventColumns = shown.some((r) => r.event);
  const headers = ["PID", "X", "Y", "High Limit", "Low Limit", "實際數值", "SBin", "HBin", ...(showEventColumns ? ["事件編號"] : []), "判定原因"];
  const numeric = new Set(["X", "Y", "High Limit", "Low Limit", "實際數值"]);
  const cell = { padding: "7px 12px", whiteSpace: "nowrap" as const };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surfaceVariant, borderRadius: 10, padding: "6px 12px", maxWidth: "100%" }}>
          <span style={{ fontSize: 12, color: C.muted }}>異常事件</span>
          <select
            value={active}
            onChange={(e) => setEvent(e.target.value)}
            style={{ background: "transparent", border: "none", fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.text, outline: "none", maxWidth: 420 }}
          >
            <option value={ALL}>全部 Fail（{rows.length} 筆，{options.length} 個事件）</option>
            {options.map(([e, o]) => (
              <option key={e} value={e}>
                {o.meaning ? `${e}｜${o.meaning}（${o.count}）` : `${e}（${o.count}）`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflowX: "auto" }}>
        <table style={{ width: "100%", fontFamily: MONO, fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.surface }}>
              {headers.map((h) => (
                <th key={h} style={{ ...cell, textAlign: numeric.has(h) ? "right" : "left", fontWeight: 500, color: C.muted, fontSize: 12 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={`${r.pid}-${r.event ?? "bin"}-${i}`} style={{ borderTop: `1px solid ${C.borderLight}` }}>
                <td style={{ ...cell, color: C.sub }}>{r.pid}</td>
                <td style={{ ...cell, textAlign: "right" }}>{r.x}</td>
                <td style={{ ...cell, textAlign: "right" }}>{r.y}</td>
                <td style={{ ...cell, textAlign: "right", color: C.muted }}>{r.highLimit ?? "—"}</td>
                <td style={{ ...cell, textAlign: "right", color: C.muted }}>{r.lowLimit ?? "—"}</td>
                <td style={{ ...cell, textAlign: "right", fontWeight: 600, color: C.red }}>{r.value ?? "—"}</td>
                <td style={cell}>{formatSoftBin(r.softBin)}</td>
                <td style={cell}>{formatHardBin(r.hardBin)}</td>
                {showEventColumns && <td style={{ ...cell, color: C.sub }}>{r.event ?? "—"}</td>}
                <td style={{ ...cell, fontFamily: "inherit", color: C.sub }}>{reasonFor(r)}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={headers.length} style={{ padding: "16px 12px", textAlign: "center", color: C.muted }}>
                  這個 Site 沒有 Fail 異常資料
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function reasonFor(row: FailRow): string {
  if (row.meaning) return row.meaning;
  if (row.value !== null && row.highLimit !== null && row.value > row.highLimit) {
    return `實際值 ${row.value} 超過 High Limit ${row.highLimit}`;
  }
  if (row.value !== null && row.lowLimit !== null && row.value < row.lowLimit) {
    return `實際值 ${row.value} 低於 Low Limit ${row.lowLimit}`;
  }
  return `PF=Fail（SBin ${row.softBin} / HBin ${row.hardBin}）`;
}
