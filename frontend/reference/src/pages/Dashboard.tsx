import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts'
import {
  C, SiteData, SiteStatus, rng, makeSiteData, useNow,
  StatusDot, SectionHeader, Layout, NAV_ITEMS,
} from '../shared'
import NotificationPanel from '../components/NotificationPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertType = 'MeanTrendUp' | 'MeanTrendDown' | 'StdevTrendUp' | 'StdevTrendDown' | 'SiteUnbalance' | 'LowYield'

interface TrendPoint { x: number; value: number; ucl: number; lcl: number; mean: number; anomaly?: boolean }
interface TrendAlert { id: string; type: AlertType; site: number; param: string; time: string; trend: TrendPoint[] }
interface Lot { id: string; waferCount: number; passRate: number; hasIssue: boolean }
interface WaferInfo { id: string; passRate: number; hasIssue: boolean }
interface DieCell { row: number; col: number; valid: boolean; pass: boolean; bin: number }
interface FailedDevice { pid: string; site: number; param: string; value: number; low: number; high: number; bin: string; explanation: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const MONO = "'Roboto Mono', monospace"

function generateTrendData(baseVal: number, std: number, anomalyAt: number[], seed = 42): TrendPoint[] {
  let s = seed
  const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0x100000000 }
  const mean = baseVal, ucl = mean + 3 * std, lcl = mean - 3 * std
  return Array.from({ length: 50 }, (_, i) => {
    const isAnomaly = anomalyAt.includes(i)
    const noise = (rand() - 0.5) * std * 2
    const drift = isAnomaly ? std * 4 * (rand() > 0.5 ? 1 : -1) : 0
    return { x: i + 1, value: parseFloat((mean + noise + drift).toFixed(3)), ucl, lcl, mean, anomaly: isAnomaly }
  })
}

function generateWaferDies(passRate: number, seed = 1): DieCell[] {
  const r = rng(seed)
  const rows = 16, cols = 18, cx = cols / 2, cy = rows / 2, radius = 7.5
  const dies: DieCell[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dx = col + 0.5 - cx, dy = row + 0.5 - cy
      const valid = Math.sqrt(dx * dx + dy * dy) <= radius
      if (!valid) { dies.push({ row, col, valid: false, pass: false, bin: 0 }); continue }
      const pass = r() < passRate / 100
      const bin = pass ? 1 : (r() < 0.6 ? 2 : r() < 0.7 ? 3 : 4)
      dies.push({ row, col, valid: true, pass, bin })
    }
  }
  return dies
}

const BIN_COLORS: Record<number, string> = { 1: '#43A047', 2: '#EF5350', 3: '#FF8A65', 4: '#AB47BC' }

const LOTS: Lot[] = [
  { id: 'LOT-2026-0093', waferCount: 25, passRate: 83.4, hasIssue: true },
  { id: 'LOT-2026-0091', waferCount: 25, passRate: 91.2, hasIssue: false },
  { id: 'LOT-2026-0088', waferCount: 24, passRate: 88.7, hasIssue: false },
]

function makeLotWafers(lotIdx: number): WaferInfo[] {
  const rand = rng(lotIdx * 17 + 3)
  return Array.from({ length: LOTS[lotIdx].waferCount }, (_, i) => {
    const pr = 70 + rand() * 30
    return { id: `W${i + 1}`, passRate: parseFloat(pr.toFixed(1)), hasIssue: pr < 80 }
  })
}

const BIN_PARETO = [
  { bin: 'Bin-1', count: 4180, fill: '#43A047' },
  { bin: 'Bin-2', count: 512,  fill: '#EF5350' },
  { bin: 'Bin-3', count: 184,  fill: '#FF8A65' },
  { bin: 'Bin-4', count: 64,   fill: '#AB47BC' },
]

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  MeanTrendUp: '↑ Mean Trend Up', MeanTrendDown: '↓ Mean Trend Down',
  StdevTrendUp: '▲ Stdev Trend Up', StdevTrendDown: '▼ Stdev Trend Down',
  SiteUnbalance: '⚖ Site Unbalance', LowYield: '⚠ Low Yield',
}
const ALERT_COLORS: Record<AlertType, string> = {
  MeanTrendUp: C.ucl, MeanTrendDown: C.ucl,
  StdevTrendUp: '#B45309', StdevTrendDown: '#B45309',
  SiteUnbalance: C.red, LowYield: C.red,
}
const ALERT_BG: Record<AlertType, string> = {
  MeanTrendUp: '#FFF3E0', MeanTrendDown: '#FFF3E0',
  StdevTrendUp: '#FFFDE7', StdevTrendDown: '#FFFDE7',
  SiteUnbalance: C.redBg, LowYield: C.redBg,
}

const INIT_ALERTS: TrendAlert[] = [
  { id: 'a1', type: 'SiteUnbalance', site: 2, param: 'IDDQ_A1', time: '14:23:01', trend: generateTrendData(21.5, 2.1, [38, 43, 47], 11) },
  { id: 'a2', type: 'MeanTrendUp',   site: 2, param: 'IDDQ_A1', time: '14:19:44', trend: generateTrendData(20.0, 1.8, [44, 46, 49], 22) },
  { id: 'a3', type: 'LowYield',      site: 2, param: 'IDDQ_A1', time: '14:15:22', trend: generateTrendData(22.0, 2.5, [40, 42],     33) },
  { id: 'a4', type: 'StdevTrendUp',  site: 1, param: 'IDDQ_A1', time: '14:08:17', trend: generateTrendData(19.5, 1.5, [45, 48],     44) },
]

const FAILURES: FailedDevice[] = [
  { pid: 'PID-000142', site: 2, param: 'IDDQ_A1', value: 34.2, low: 12.1, high: 30.0, bin: 'Bin-2', explanation: '此 device 的 IDDQ_A1 量測值 34.2 mA 超出上限 30.0 mA (+4.2 mA)，且位於異常 Site 2，可能與該 site 的量測偏移有關。' },
  { pid: 'PID-000087', site: 2, param: 'IDDQ_A1', value: 31.8, low: 12.1, high: 30.0, bin: 'Bin-2', explanation: '此 device 的 IDDQ_A1 量測值 31.8 mA 超出上限 30.0 mA (+1.8 mA)。Site 2 連續 3 片 wafer 出現此類偏高情況，疑似接觸阻抗異常。' },
  { pid: 'PID-000201', site: 1, param: 'IDDQ_A1', value: 10.5, low: 12.1, high: 30.0, bin: 'Bin-3', explanation: '此 device 的 IDDQ_A1 量測值 10.5 mA 低於下限 12.1 mA (-1.6 mA)。位於 Site 1 邊緣區域，可能為 probe 接觸不良。' },
  { pid: 'PID-000315', site: 3, param: 'IDDQ_A1', value: 32.9, low: 12.1, high: 30.0, bin: 'Bin-2', explanation: '此 device 的 IDDQ_A1 量測值 32.9 mA 超出上限 30.0 mA (+2.9 mA)。為單發事件，可能為個別 die 缺陷。' },
  { pid: 'PID-000408', site: 2, param: 'IDDQ_A1', value: 35.7, low: 12.1, high: 30.0, bin: 'Bin-4', explanation: '此 device 的 IDDQ_A1 量測值 35.7 mA 嚴重超出上限 (+5.7 mA)，為本批最高偏移量。Site 2 需立即確認 chuck 溫度與探針壓力。' },
]

// ─── Section 1: Site Status ───────────────────────────────────────────────────

function SiteBoxplot({ sites }: { sites: SiteData[] }) {
  const W = 520, H = 160, pad = 40
  const slotW = (W - pad * 2) / sites.length
  const allVals = sites.flatMap(s => s.dist)
  const minV = Math.min(...allVals) - 1, maxV = Math.max(...allVals) + 1
  const sy = (v: number) => pad + ((maxV - v) / (maxV - minV)) * (H - pad * 2)
  const colors: Record<SiteStatus, string> = { normal: C.green, warning: '#D97706', error: C.red }
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: MONO }}>
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke={C.border} strokeWidth={1} />
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const v = minV + t * (maxV - minV), y = sy(v)
        return (
          <g key={t}>
            <line x1={pad} y1={y} x2={W - pad} y2={y} stroke={C.borderLight} strokeWidth={1} />
            <text x={pad - 5} y={y + 3} textAnchor="end" fontSize={9} fill={C.muted}>{v.toFixed(1)}</text>
          </g>
        )
      })}
      {sites.map((s, i) => {
        const [vmin, q1, med, q3, vmax] = s.dist, cx = pad + slotW * i + slotW / 2, bw = slotW * 0.4, col = colors[s.status]
        return (
          <g key={s.id}>
            <line x1={cx} y1={sy(vmin)} x2={cx} y2={sy(vmax)} stroke={col} strokeWidth={1} opacity={0.4} />
            <line x1={cx - 8} y1={sy(vmin)} x2={cx + 8} y2={sy(vmin)} stroke={col} strokeWidth={1.5} />
            <line x1={cx - 8} y1={sy(vmax)} x2={cx + 8} y2={sy(vmax)} stroke={col} strokeWidth={1.5} />
            <rect x={cx - bw / 2} y={sy(q3)} width={bw} height={Math.abs(sy(q1) - sy(q3))} fill={col} opacity={0.12} stroke={col} strokeWidth={1.5} rx={2} />
            <line x1={cx - bw / 2} y1={sy(med)} x2={cx + bw / 2} y2={sy(med)} stroke={col} strokeWidth={2.5} />
            <text x={cx} y={H - 4} textAnchor="middle" fontSize={10} fill={col} fontWeight={500}>Site {s.id}</text>
          </g>
        )
      })}
    </svg>
  )
}

function WaferMap({ passRate, seed, size = 240 }: { passRate: number; seed: number; size?: number }) {
  const dies = generateWaferDies(passRate, seed)
  const rows = 16, cols = 18, cellW = size / cols, cellH = size / rows
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: '#F0F0F0', border: `2px solid ${C.border}`, flexShrink: 0 }}>
      <svg width={size} height={size}>
        {dies.map((d, i) => d.valid
          ? <rect key={i} x={d.col * cellW + 0.5} y={d.row * cellH + 0.5} width={cellW - 1} height={cellH - 1} fill={BIN_COLORS[d.bin]} opacity={d.pass ? 0.85 : 0.7} />
          : null)}
      </svg>
    </div>
  )
}

function SiteCard({ site, onClick }: { site: SiteData; onClick: () => void }) {
  const isError = site.status === 'error', isWarn = site.status === 'warning'
  return (
    <button onClick={onClick} className="text-left w-full transition-all duration-150 hover:shadow-md"
      style={{ background: C.card, border: `1px solid ${isError ? C.redBorder : isWarn ? C.yellowBorder : C.border}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', boxShadow: isError ? `${C.shadowMd}, 0 0 0 1px ${C.redBorder}` : C.shadow }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: C.muted }}>SITE {site.id}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 100, background: isError ? C.redBg : isWarn ? C.yellowBg : C.greenBg, border: `1px solid ${isError ? C.redBorder : isWarn ? C.yellowBorder : C.greenBorder}` }}>
          <StatusDot status={site.status} size={6} />
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: isError ? C.red : isWarn ? C.yellow : C.green }}>{site.status.toUpperCase()}</span>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 40, lineHeight: 1, color: site.passRate >= 80 ? C.text : site.passRate >= 70 ? '#B45309' : C.red }}>
          {site.passRate.toFixed(1)}<span style={{ fontSize: 18, color: C.muted, fontWeight: 400 }}>%</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 12, marginTop: 4, color: C.muted }}>Pass Rate</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 12, borderTop: `1px solid ${C.borderLight}` }}>
        {[{ label: 'MEAN', val: site.mean.toFixed(3) }, { label: 'STDEV', val: site.stdDev.toFixed(3) }].map(({ label, val }) => (
          <div key={label}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginBottom: 3, letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: C.sub }}>{val}</div>
          </div>
        ))}
      </div>
      {site.anomalyMsg && (
        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: C.redBg, border: `1px solid ${C.redBorder}`, fontSize: 12, fontFamily: MONO, color: C.red }}>{site.anomalyMsg}</div>
      )}
    </button>
  )
}

function SiteDrawer({ site, allSites, onClose }: { site: SiteData | null; allSites: SiteData[]; onClose: () => void }) {
  const open = site !== null
  const testResults = site
    ? Array.from({ length: 20 }, (_, i) => {
        const rand = rng((site.id * 100 + i) * 13)
        const val = site.mean + (rand() - 0.5) * site.stdDev * 4
        const pass = val >= 12.1 && val <= 30.0
        return { pid: `PID-${String(i + 1).padStart(6, '0')}`, value: parseFloat(val.toFixed(3)), pass, bin: pass ? 'Bin-1' : val > 30 ? 'Bin-2' : 'Bin-3' }
      })
    : []
  return (
    <>
      {open && <div className="drawer-overlay" onClick={onClose} />}
      <div className={`drawer-panel ${open ? '' : 'closed'}`}>
        {site && (
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Site Detail — IDDQ_A1</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <StatusDot status={site.status} size={9} />
                  <span style={{ fontWeight: 500, fontSize: 18, color: C.text }}>Site {site.id}</span>
                  <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, color: site.passRate >= 80 ? C.green : C.red }}>{site.passRate.toFixed(1)}%</span>
                </div>
              </div>
              <button onClick={onClose} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: C.surface, color: C.muted, border: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>IDDQ_A1 Distribution — All Sites</div>
              <div style={{ background: C.surface, borderRadius: 8, padding: '12px 8px', border: `1px solid ${C.border}` }}>
                <SiteBoxplot sites={allSites} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Latest Results — Site {site.id}</div>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', fontFamily: MONO, fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.surface }}>
                      {['PID', 'Value (mA)', 'Limits', 'Bin'].map(h => (
                        <th key={h} style={{ textAlign: h === 'PID' ? 'left' : 'right', padding: '8px 12px', fontWeight: 500, color: C.muted, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.map((r, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${C.borderLight}`, background: i % 2 === 0 ? C.card : C.surface }}>
                        <td style={{ padding: '7px 12px', color: C.sub }}>{r.pid}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 500, color: r.pass ? C.text : C.red }}>{r.value}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: C.muted }}>12.1–30.0</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: r.pass ? C.greenBg : C.redBg, color: r.pass ? C.green : C.red }}>{r.bin}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Section 2: Trend Alert charts ────────────────────────────────────────────

function TrendAlertRow({ alert }: { alert: TrendAlert }) {
  const color = ALERT_COLORS[alert.type], bg = ALERT_BG[alert.type]
  const meanVal = alert.trend[0]?.mean ?? 0, ucl = alert.trend[0]?.ucl ?? 0, lcl = alert.trend[0]?.lcl ?? 0
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props
    if (!payload?.anomaly) return null
    return <circle cx={cx} cy={cy} r={4} fill={C.red} stroke="#fff" strokeWidth={1.5} />
  }
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden', boxShadow: C.shadow }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 100, background: bg, color }}>{ALERT_TYPE_LABELS[alert.type]}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.sub }}>Site {alert.site} — {alert.param}</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted, marginLeft: 'auto' }}>{alert.time}</span>
      </div>
      <div style={{ background: C.surface, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontFamily: MONO, fontSize: 13, flexWrap: 'wrap' }}>
          <span style={{ color: C.muted }}>Mean: <span style={{ color: C.text, fontWeight: 600 }}>{meanVal.toFixed(3)}</span></span>
          <span style={{ color: C.muted }}>UCL: <span style={{ color: C.ucl, fontWeight: 600 }}>{ucl.toFixed(3)}</span></span>
          <span style={{ color: C.muted }}>LCL: <span style={{ color: C.lcl, fontWeight: 600 }}>{lcl.toFixed(3)}</span></span>
          <span style={{ color: C.dim }}>mA · TN 80000 · Pin IO1</span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={alert.trend} margin={{ top: 8, right: 20, bottom: 0, left: 32 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
            <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.muted, fontFamily: MONO }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.muted, fontFamily: MONO }} tickLine={false} axisLine={false} width={30} />
            <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: MONO, boxShadow: C.shadowMd }}
              itemStyle={{ color: C.text }} labelStyle={{ color: C.muted }} />
            <ReferenceLine y={ucl} stroke={C.ucl} strokeDasharray="4 2" strokeWidth={1} label={{ value: 'UCL', position: 'right', fontSize: 10, fill: C.ucl }} />
            <ReferenceLine y={lcl} stroke={C.lcl} strokeDasharray="4 2" strokeWidth={1} label={{ value: 'LCL', position: 'right', fontSize: 10, fill: C.lcl }} />
            <ReferenceLine y={meanVal} stroke={C.dim} strokeDasharray="2 2" strokeWidth={1} />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={<CustomDot />} activeDot={{ r: 3, fill: color }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Section 3: Lot Browser ───────────────────────────────────────────────────

function WaferThumb({ wafer, active, onClick }: { wafer: WaferInfo; active: boolean; onClick: () => void }) {
  const dotColor = wafer.passRate >= 90 ? C.green : wafer.passRate >= 80 ? '#D97706' : C.red
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}>
      <div style={{ width: 42, height: 42, borderRadius: '50%', border: `2px solid ${active ? dotColor : wafer.hasIssue ? C.redBorder : C.border}`, background: active ? `${dotColor}1A` : C.card, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: active ? C.shadowMd : 'none', transition: 'all 0.15s' }}>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, color: dotColor }}>{Math.round(wafer.passRate)}%</span>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{wafer.id}</span>
    </button>
  )
}

function LotBrowser() {
  const [selectedLot, setSelectedLot] = useState<number | null>(0)
  const [selectedWaferIdx, setSelectedWaferIdx] = useState<number | null>(0)
  const wafers = selectedLot !== null ? makeLotWafers(selectedLot) : []
  const selectedWafer = selectedWaferIdx !== null ? wafers[selectedWaferIdx] : null

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {LOTS.map((lot, i) => (
          <button key={lot.id} onClick={() => { setSelectedLot(i === selectedLot ? null : i); setSelectedWaferIdx(null) }}
            style={{ textAlign: 'left', transition: 'all 0.15s', background: selectedLot === i ? C.text : C.card, border: `1px solid ${selectedLot === i ? C.text : C.border}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', boxShadow: C.shadow }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: selectedLot === i ? '#9E9E9E' : C.muted }}>{lot.id}</span>
              {lot.hasIssue && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.red, display: 'block' }} />}
            </div>
            <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 26, marginBottom: 4, color: selectedLot === i ? '#fff' : lot.passRate >= 85 ? C.text : '#B45309' }}>{lot.passRate.toFixed(1)}%</div>
            <div style={{ fontSize: 12, color: selectedLot === i ? '#9E9E9E' : C.muted }}>{lot.waferCount} wafers</div>
          </button>
        ))}
      </div>

      {selectedLot !== null && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, background: C.card, marginBottom: 12, boxShadow: C.shadow }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.borderLight}` }}>
            {[
              { label: 'LOT ID', val: LOTS[selectedLot].id, color: C.text },
              { label: 'PASS RATE', val: `${LOTS[selectedLot].passRate.toFixed(1)}%`, color: C.text },
              { label: 'WAFERS', val: `${LOTS[selectedLot].waferCount}`, color: C.text },
              { label: 'ISSUE WAFERS', val: `${wafers.filter(w => w.hasIssue).length}`, color: C.red },
            ].map(({ label, val, color }) => (
              <div key={label}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: '0.06em', marginBottom: 8 }}>BIN PARETO</div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={BIN_PARETO} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="bin" tick={{ fontSize: 11, fill: C.muted, fontFamily: MONO }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: MONO }} labelStyle={{ color: C.muted }} itemStyle={{ color: C.text }} />
                <Bar dataKey="count" radius={3}>{BIN_PARETO.map((e, i) => <Cell key={i} fill={e.fill} opacity={0.75} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: '0.06em', marginBottom: 10 }}>WAFER GRID — CLICK TO INSPECT</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {wafers.map((w, i) => (
              <WaferThumb key={w.id} wafer={w} active={selectedWaferIdx === i} onClick={() => setSelectedWaferIdx(selectedWaferIdx === i ? null : i)} />
            ))}
          </div>
        </div>
      )}

      {selectedWafer && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, background: C.card, boxShadow: C.shadow }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>WAFER</div>
              <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: C.text }}>{selectedWafer.id}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>PASS RATE</div>
              <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: selectedWafer.passRate >= 80 ? C.green : C.red }}>{selectedWafer.passRate.toFixed(1)}%</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              {Object.entries(BIN_COLORS).map(([bin, color]) => (
                <span key={bin} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.muted }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
                  {bin === '1' ? 'PASS' : `Bin-${bin}`}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <WaferMap passRate={selectedWafer.passRate} seed={(selectedWaferIdx ?? 0) + 1} size={Math.min(300, typeof window !== 'undefined' ? window.innerWidth - 80 : 300)} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Section 4: Failure Explainer ─────────────────────────────────────────────

function FailureExplainer() {
  return (
    <div>
      {FAILURES.map(f => {
        const overHigh = f.value > f.high, delta = overHigh ? f.value - f.high : f.low - f.value
        return (
          <div key={f.pid} style={{ border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 8, overflow: 'hidden', boxShadow: C.shadow }}>
            <div style={{ padding: '12px 16px', background: C.card, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.text }}>{f.pid}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, padding: '2px 10px', borderRadius: 100, background: C.surfaceVariant, color: C.muted }}>Site {f.site}</span>
                <span style={{ fontSize: 13, color: C.muted }}>{f.param}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C.red }}>{f.value.toFixed(1)} mA</span>
                <span style={{ fontSize: 13, color: C.red }}>{overHigh ? `↑ +${delta.toFixed(1)} over HI` : `↓ -${delta.toFixed(1)} under LO`}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, padding: '2px 10px', borderRadius: 100, fontWeight: 600, background: C.redBg, color: C.red, marginLeft: 'auto' }}>{f.bin}</span>
              </div>
            </div>
            <div style={{ background: C.surface, padding: '10px 16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 8, fontFamily: MONO, fontSize: 12, color: C.muted }}>
                <span>Limits: <span style={{ color: C.sub, fontWeight: 600 }}>{f.low}–{f.high} mA</span></span>
                <span>TN: <span style={{ color: C.sub, fontWeight: 600 }}>80000</span></span>
                <span>Pin: <span style={{ color: C.sub, fontWeight: 600 }}>IO1</span></span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, padding: '10px 14px', borderRadius: 8, background: C.card, border: `1px solid ${C.border}`, color: C.sub }}>{f.explanation}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [tick, setTick] = useState(0)
  const [sites, setSites] = useState(() => makeSiteData(0))
  const [drawerSite, setDrawerSite] = useState<SiteData | null>(null)
  const [activeSection, setActiveSection] = useState('s1')
  const now = useNow()

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => { const next = t + 1; setSites(makeSiteData(next)); return next })
    }, 5000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => { entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id) }) },
      { threshold: 0.3 }
    )
    NAV_ITEMS.filter(n => !n.page).forEach(item => {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <Layout sites={sites} tick={tick} lastUpdate={now.toLocaleTimeString('en-GB')} activeSection={activeSection}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* ── Left: main content ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Section 1: Sites */}
          <div id="s1" style={{ marginBottom: 40 }}>
            <SectionHeader id="s1" label="Site Status — IDDQ_A1" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {sites.map(s => <SiteCard key={s.id} site={s} onClick={() => setDrawerSite(s)} />)}
            </div>
          </div>

          {/* Section 2: Trend Alerts */}
          <div id="s2" style={{ marginBottom: 40 }}>
            <SectionHeader id="s2" label="Trend Alerts" count={INIT_ALERTS.length} />
            {/* Notification panel on mobile (< xl) */}
            <div className="xl:hidden" style={{ marginBottom: 20 }}>
              <NotificationPanel tick={tick} />
            </div>
            {INIT_ALERTS.map(alert => <TrendAlertRow key={alert.id} alert={alert} />)}
          </div>

          {/* Section 3: Lot Browser */}
          <div id="s3" style={{ marginBottom: 40 }}>
            <SectionHeader id="s3" label="Lot / Wafer Browser" />
            <LotBrowser />
          </div>

          {/* Section 4: Failure Explainer */}
          <div id="s4" style={{ marginBottom: 40 }}>
            <SectionHeader id="s4" label="Failure Explainer" count={FAILURES.length} />
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.muted, marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <span>Param: IDDQ_A1</span><span>TN: 80000</span><span>Pin: IO1</span><span>Limits: 12.1–30.0 mA</span>
            </div>
            <FailureExplainer />
          </div>
        </div>

        {/* ── Right: placeholder reserves space on xl ── */}
        <div className="hidden xl:block" style={{ width: 324, flexShrink: 0 }} />
      </div>

      {/* ── Fixed right notification panel (xl+) ── */}
      <div className="hidden xl:flex flex-col" style={{
        position: 'fixed',
        top: 56,
        right: 0,
        bottom: 0,
        width: 324,
        background: C.bg,
        borderLeft: `1px solid ${C.border}`,
        overflowY: 'auto',
        zIndex: 20,
        padding: '16px 14px',
      }}>
        <NotificationPanel tick={tick} />
      </div>

      <SiteDrawer site={drawerSite} allSites={sites} onClose={() => setDrawerSite(null)} />
    </Layout>
  )
}
