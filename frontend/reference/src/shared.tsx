import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router'

// ─── Theme tokens (Material Design 3) — v2 ───────────────────────────────────

export const C = {
  bg: '#F4F4F4',
  card: '#FFFFFF',
  surface: '#F7F7F7',
  surfaceVariant: '#EBEBEB',
  border: '#E0E0E0',
  borderLight: '#EEEEEE',
  text: '#1C1B1F',
  sub: '#49454F',
  muted: '#757575',
  dim: '#BDBDBD',
  green: '#1B6B36',
  greenBg: '#E8F5E9',
  greenBorder: '#A5D6A7',
  greenDot: '#43A047',
  yellow: '#795B00',
  yellowBg: '#FFFDE7',
  yellowBorder: '#FFD54F',
  red: '#B3261E',
  redBg: '#FCEDEB',
  redBorder: '#F2B8B5',
  blue: '#1A73E8',
  blueBg: '#E8F0FE',
  ucl: '#E65100',
  lcl: '#5E35B1',
  shadow: '0 1px 2px rgba(0,0,0,0.07), 0 1px 5px rgba(0,0,0,0.05)',
  shadowMd: '0 2px 6px rgba(0,0,0,0.09), 0 4px 16px rgba(0,0,0,0.07)',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type SiteStatus = 'normal' | 'warning' | 'error'
export type AlertType = 'MeanTrendUp' | 'MeanTrendDown' | 'StdevTrendUp' | 'StdevTrendDown' | 'SiteUnbalance' | 'LowYield'
export type NotifStatus = 'sent' | 'confirmed' | 'pending'

export interface SiteData {
  id: number
  passRate: number
  mean: number
  stdDev: number
  status: SiteStatus
  anomalyMsg?: string
  dist: number[]
}

export interface ThermalSite {
  siteId: number
  predicted: number
  threshold: number
  confidence: number
  notified: boolean
}

export interface SensorData {
  name: string
  points: Array<{ t: number; pred: number; actual: number }>
}

export interface NotifEvent {
  time: string
  site: number
  action: string
  status: NotifStatus
}

// ─── Mock Data Generators ─────────────────────────────────────────────────────

export function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0x100000000
  }
}

export function makeSiteData(tick: number): SiteData[] {
  const base = [
    { id: 1, pr: 85.0, mean: 19.82, std: 1.61 },
    { id: 2, pr: 75.0, mean: 28.30, std: 2.50 },
    { id: 3, pr: 90.0, mean: 20.15, std: 1.45 },
    { id: 4, pr: 100.0, mean: 19.94, std: 1.32 },
  ]
  const rand = rng(tick * 7 + 3)
  return base.map(s => {
    const pr = Math.min(100, Math.max(0, s.pr + (rand() - 0.5) * 0.5))
    const mean = s.mean + (rand() - 0.5) * 0.1
    const std = s.std + (rand() - 0.5) * 0.05
    const status: SiteStatus = pr < 80 ? 'error' : pr < 85 ? 'warning' : 'normal'
    const anomalyMsg = s.id === 2
      ? `Site unbalance: mean ${mean.toFixed(3)} mA 偏離整體 ${(mean - 20).toFixed(3)} mA`
      : undefined
    const q1 = mean - std * 0.67, q3 = mean + std * 0.67
    return {
      id: s.id,
      passRate: parseFloat(pr.toFixed(1)),
      mean: parseFloat(mean.toFixed(3)),
      stdDev: parseFloat(Math.abs(std).toFixed(3)),
      status,
      anomalyMsg,
      dist: [mean - std * 2, q1, mean, q3, mean + std * 2].map(v => parseFloat(v.toFixed(3))),
    }
  })
}

export function makeThermal(tick: number): ThermalSite[] {
  const rand = rng(tick * 13 + 5)
  return [68, 94, 72, 81].map((base, i) => {
    const predicted = base + (rand() - 0.5) * 2
    return {
      siteId: i + 1,
      predicted: parseFloat(predicted.toFixed(1)),
      threshold: 90,
      confidence: parseFloat((0.85 + rand() * 0.12).toFixed(2)),
      notified: predicted >= 90,
    }
  })
}

export const SENSORS: SensorData[] = [
  'sensor1#CP', 'sensor2#DS0', 'sensor3#IO4', 'sensor4#IO1', 'sensor5#IO2', 'sensor6#IO3',
].map((name, idx) => {
  const rand = rng(idx * 31 + 7)
  const points = Array.from({ length: 30 }, (_, t) => {
    const pred = 55 + idx * 4 + rand() * 6
    const err = (rand() - 0.5) * 4
    return { t, pred: parseFloat(pred.toFixed(1)), actual: parseFloat((pred + err).toFixed(1)) }
  })
  return { name, points }
})

export const NOTIF_HISTORY: NotifEvent[] = [
  { time: '14:22:15', site: 2, action: 'Temp threshold exceeded → Halt site', status: 'confirmed' },
  { time: '14:19:03', site: 2, action: 'Predictive alert sent to tester', status: 'confirmed' },
  { time: '14:15:47', site: 4, action: 'Predictive alert sent to tester', status: 'sent' },
  { time: '14:12:30', site: 1, action: 'Temp check triggered', status: 'confirmed' },
  { time: '13:58:44', site: 3, action: 'Monitoring resumed after cool-down', status: 'confirmed' },
]

export function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

// ─── Primitive UI Components ──────────────────────────────────────────────────

export function StatusDot({ status, size = 7 }: { status: SiteStatus; size?: number }) {
  const color = status === 'normal' ? C.greenDot : status === 'warning' ? '#FFA726' : '#EF5350'
  return (
    <span style={{ width: size, height: size, background: color, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
  )
}

export function LiveBadge({ tick }: { tick: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 100, background: C.greenBg, border: `1px solid ${C.greenBorder}` }}>
      <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: C.greenDot, display: 'block', flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: C.green }}>LIVE</span>
      <span style={{ fontSize: 12, color: C.dim }}>#{tick}</span>
    </div>
  )
}

export function SectionHeader({ id, label, count }: { id: string; label: string; count?: number }) {
  return (
    <div id={id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
      {count !== undefined && (
        <span style={{ fontSize: 11, fontWeight: 500, background: C.surfaceVariant, color: C.muted, borderRadius: 100, padding: '2px 8px' }}>{count}</span>
      )}
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  )
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export const NAV_ITEMS = [
  { id: 's1', label: 'Sites',   icon: '◈', anchor: '#s1',      page: false },
  { id: 's5', label: 'Thermal', icon: '◉', anchor: '/thermal', page: true },
]

export function Header({ sites, tick, lastUpdate }: { sites: SiteData[]; tick: number; lastUpdate: string }) {
  const location = useLocation()
  const onThermal = location.pathname === '/thermal'
  const systemStatus: SiteStatus = sites.some(s => s.status === 'error') ? 'error'
    : sites.some(s => s.status === 'warning') ? 'warning' : 'normal'
  const statusColor = systemStatus === 'error' ? C.red : systemStatus === 'warning' ? C.yellow : C.green
  const statusBg = systemStatus === 'error' ? C.redBg : systemStatus === 'warning' ? C.yellowBg : C.greenBg
  const statusBorder = systemStatus === 'error' ? C.redBorder : systemStatus === 'warning' ? C.yellowBorder : C.greenBorder

  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-5"
      style={{ background: C.card, borderBottom: `1px solid ${C.border}`, height: 56, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flexShrink: 0 }}>

      {/* Logo + brand */}
      <Link to="/" className="flex items-center gap-2.5 shrink-0" style={{ textDecoration: 'none' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: "'Roboto Mono', monospace", color: '#fff', fontSize: 11, fontWeight: 700 }}>CP</span>
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
            <span style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: "'Roboto Mono', monospace" }}>LOT-2026-0093</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: C.surfaceVariant }}>
            <span style={{ fontSize: 11, color: C.muted }}>WAFER</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: "'Roboto Mono', monospace" }}>W9</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{ background: statusBg, border: `1px solid ${statusBorder}` }}>
            <StatusDot status={systemStatus} size={7} />
            <span className="hidden sm:inline" style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>
              {systemStatus === 'normal' ? 'NORMAL' : systemStatus === 'warning' ? 'WARNING' : 'ANOMALY DETECTED'}
            </span>
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden md:block" style={{ fontSize: 13, color: C.muted }}>
          Updated <span style={{ fontWeight: 500, color: C.sub }}>{lastUpdate}</span>
        </span>
        <LiveBadge tick={tick} />
      </div>
    </div>
  )
}

// ─── MD3 Navigation Rail ──────────────────────────────────────────────────────

export function Sidebar({ activeSection }: { activeSection: string }) {
  const location = useLocation()
  const onThermal = location.pathname === '/thermal'

  return (
    <nav className="hidden md:flex flex-col items-center pt-2 gap-0"
      style={{ width: 80, background: C.card, borderRight: `1px solid ${C.border}`, position: 'sticky', top: 56, height: 'calc(100vh - 56px)', flexShrink: 0, overflowY: 'auto' }}>
      {NAV_ITEMS.map(item => {
        const active = item.page ? onThermal : (!onThermal && activeSection === item.id)
        const railItem = (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 4px', width: '100%', cursor: 'pointer' }}>
            <div style={{
              width: 56, height: 32, borderRadius: 16,
              background: active ? C.blueBg : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}>
              <span style={{ fontSize: 16, color: active ? C.blue : C.muted }}>{item.icon}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? C.text : C.muted, textAlign: 'center', userSelect: 'none' }}>{item.label}</span>
          </div>
        )
        return item.page
          ? <Link key={item.id} to={item.anchor} style={{ textDecoration: 'none', width: '100%' }}>{railItem}</Link>
          : <a key={item.id} href={onThermal ? `/${item.anchor}` : item.anchor} style={{ textDecoration: 'none', width: '100%' }}>{railItem}</a>
      })}
    </nav>
  )
}

// ─── MD3 Bottom Navigation ────────────────────────────────────────────────────

export function MobileBottomNav({ activeSection }: { activeSection: string }) {
  const location = useLocation()
  const onThermal = location.pathname === '/thermal'

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex"
      style={{ background: C.card, borderTop: `1px solid ${C.border}`, boxShadow: '0 -2px 8px rgba(0,0,0,0.08)', height: 64 }}>
      {NAV_ITEMS.map(item => {
        const active = item.page ? onThermal : (!onThermal && activeSection === item.id)
        const content = (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 0' }}>
            <div style={{ width: 56, height: 32, borderRadius: 16, background: active ? C.blueBg : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 17, color: active ? C.blue : C.muted }}>{item.icon}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? C.text : C.muted }}>{item.label}</span>
          </div>
        )
        return item.page
          ? <Link key={item.id} to={item.anchor} className="flex-1 flex items-center justify-center" style={{ textDecoration: 'none' }}>{content}</Link>
          : <a key={item.id} href={onThermal ? `/${item.anchor}` : item.anchor} className="flex-1 flex items-center justify-center" style={{ textDecoration: 'none' }}>{content}</a>
      })}
    </nav>
  )
}

// ─── Shared Layout Shell ──────────────────────────────────────────────────────

export function Layout({
  children,
  sites,
  tick,
  lastUpdate,
  activeSection,
}: {
  children: React.ReactNode
  sites: SiteData[]
  tick: number
  lastUpdate: string
  activeSection: string
}) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Header sites={sites} tick={tick} lastUpdate={lastUpdate} />
      <div className="flex" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <Sidebar activeSection={activeSection} />
        <main className="flex-1 overflow-x-hidden" style={{ padding: '20px 16px 80px', minWidth: 0 }}>
          {children}
        </main>
      </div>
      <MobileBottomNav activeSection={activeSection} />
    </div>
  )
}
