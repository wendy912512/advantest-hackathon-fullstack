import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import {
  C, makeThermal, makeSiteData, SENSORS, NOTIF_HISTORY, useNow,
  StatusDot, SectionHeader, Layout,
} from '../shared'
import type { ThermalSite, NotifStatus } from '../shared'

const MONO = "'Roboto Mono', monospace"

// ─── Thermal Card ─────────────────────────────────────────────────────────────

function ThermalCard({ site }: { site: ThermalSite }) {
  const overThreshold = site.predicted >= site.threshold
  const nearThreshold = site.predicted >= site.threshold - 5
  const statusColor = overThreshold ? C.red : nearThreshold ? C.yellow : C.green
  const statusBg = overThreshold ? C.redBg : nearThreshold ? C.yellowBg : C.greenBg
  const statusBorder = overThreshold ? C.redBorder : nearThreshold ? C.yellowBorder : C.greenBorder
  const pct = Math.min(100, (site.predicted / site.threshold) * 100)

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${overThreshold ? C.redBorder : C.border}`,
      borderRadius: 12,
      padding: '18px 20px',
      boxShadow: overThreshold ? `${C.shadowMd}, 0 0 0 1px ${C.redBorder}` : C.shadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: C.muted }}>SITE {site.siteId}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 100, background: statusBg, border: `1px solid ${statusBorder}` }}>
          {overThreshold && <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: C.red, display: 'block', flexShrink: 0 }} />}
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: statusColor }}>
            {overThreshold ? 'OVER LIMIT' : nearThreshold ? 'WARNING' : 'NORMAL'}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 42, lineHeight: 1, color: statusColor }}>
          {site.predicted.toFixed(1)}<span style={{ fontSize: 16, color: C.muted, fontWeight: 400 }}>°C</span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Predicted Temperature</div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ height: 6, borderRadius: 3, background: C.borderLight, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: overThreshold ? C.red : nearThreshold ? '#D97706' : C.green, borderRadius: 3, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontFamily: MONO, fontSize: 11, color: C.muted }}>
          <span>0°C</span>
          <span>Threshold: {site.threshold}°C</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 12, borderTop: `1px solid ${C.borderLight}` }}>
        {[{ label: 'THRESHOLD', val: `${site.threshold}°C` }, { label: 'CONFIDENCE', val: `${(site.confidence * 100).toFixed(0)}%` }].map(({ label, val }) => (
          <div key={label}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C.text }}>{val}</div>
          </div>
        ))}
      </div>

    </div>
  )
}

// ─── Notification Log ─────────────────────────────────────────────────────────

const STATUS_STYLES: Record<NotifStatus, { color: string; bg: string; border: string; label: string }> = {
  confirmed: { color: C.green,  bg: C.greenBg,  border: C.greenBorder,  label: 'Confirmed' },
  sent:      { color: C.blue,   bg: C.blueBg,   border: '#BFDBFE',      label: 'Sent' },
  pending:   { color: C.yellow, bg: C.yellowBg, border: C.yellowBorder, label: 'Pending' },
}

function NotificationLog() {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: C.shadow }}>
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: C.red, display: 'block', flexShrink: 0 }} />
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: C.muted }}>MACHINE NOTIFICATION LOG</span>
      </div>
      {NOTIF_HISTORY.map((ev, i) => {
        const sc = STATUS_STYLES[ev.status]
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '10px 16px', borderBottom: i < NOTIF_HISTORY.length - 1 ? `1px solid ${C.borderLight}` : 'none', background: C.card }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted, flexShrink: 0 }}>{ev.time}</span>
            <span style={{ fontFamily: MONO, fontSize: 12, padding: '2px 10px', borderRadius: 100, background: C.surfaceVariant, color: C.sub, flexShrink: 0 }}>Site {ev.site}</span>
            <span style={{ fontSize: 13, color: C.sub, flex: 1 }}>{ev.action}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 100, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, flexShrink: 0 }}>{sc.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Sensor Residual Chart ────────────────────────────────────────────────────

function SensorResidualChart({ sensor }: { sensor: { name: string; points: Array<{ t: number; pred: number; actual: number }> } }) {
  const residuals = sensor.points.map(p => ({ t: p.t, residual: parseFloat((p.actual - p.pred).toFixed(2)) }))
  const maxAbs = Math.max(...residuals.map(r => Math.abs(r.residual)), 3)
  const warn = maxAbs * 0.6

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: C.shadow }}>
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, color: C.sub }}>{sensor.name}</span>
        <span style={{ fontSize: 12, color: C.muted }}>Residual = Actual − Predicted</span>
      </div>
      <div style={{ background: C.card, padding: '12px 16px 8px' }}>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={residuals} margin={{ top: 8, right: 16, bottom: 0, left: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: C.muted, fontFamily: MONO }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.muted, fontFamily: MONO }} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: MONO, boxShadow: C.shadowMd }}
              itemStyle={{ color: C.text }}
              formatter={(v: unknown) => [typeof v === 'number' ? v.toFixed(2) : String(v), 'Residual'] as [string, string]}
              labelFormatter={(l: unknown) => `t=${l}`}
            />
            <ReferenceLine y={0} stroke={C.dim} strokeWidth={1.5} />
            <ReferenceLine y={warn} stroke="#F59E0B" strokeDasharray="3 2" strokeWidth={1} />
            <ReferenceLine y={-warn} stroke="#F59E0B" strokeDasharray="3 2" strokeWidth={1} />
            <Line type="monotone" dataKey="residual" stroke={C.blue} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: C.blue }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Thermal Page ─────────────────────────────────────────────────────────────

export default function ThermalPage() {
  const [tick, setTick] = useState(0)
  const [thermalSites, setThermalSites] = useState(() => makeThermal(0))
  const [sites, setSites] = useState(() => makeSiteData(0))
  const now = useNow()

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => {
        const next = t + 1
        setThermalSites(makeThermal(next))
        setSites(makeSiteData(next))
        return next
      })
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const overCount = thermalSites.filter(s => s.predicted >= s.threshold).length

  return (
    <Layout sites={sites} tick={tick} lastUpdate={now.toLocaleTimeString('en-GB')} activeSection="s5">

      {/* Section: Thermal Status */}
      <div style={{ marginBottom: 40 }}>
        <SectionHeader id="s5" label="IC Thermal Prediction — All Sites" count={thermalSites.length} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
          {thermalSites.map(site => <ThermalCard key={site.siteId} site={site} />)}
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { label: 'MAX TEMP', val: `${Math.max(...thermalSites.map(s => s.predicted)).toFixed(1)}°C`, color: overCount > 0 ? C.red : C.text },
            { label: 'AVG TEMP', val: `${(thermalSites.reduce((a, s) => a + s.predicted, 0) / thermalSites.length).toFixed(1)}°C`, color: C.text },
            { label: 'THRESHOLD', val: '90°C', color: C.muted },
            { label: 'ALERTS SENT', val: `${thermalSites.filter(s => s.notified).length}`, color: overCount > 0 ? C.red : C.text },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', boxShadow: C.shadow }}>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
              <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Notification Log */}
      <div style={{ marginBottom: 40 }}>
        <SectionHeader id="notif" label="Machine Notification Log" count={NOTIF_HISTORY.length} />
        <NotificationLog />
      </div>

      {/* Section: Model Validation Console */}
      <div style={{ marginBottom: 40 }}>
        <SectionHeader id="console" label="Thermal Model Validation Console" />
        <div style={{ fontFamily: MONO, fontSize: 12, color: C.muted, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <span>Model: GradientBoost v2.1</span>
          <span>·</span>
          <span>Sensors: 6</span>
          <span>·</span>
          <span>Window: 30 pts</span>
          <span>·</span>
          <span>Residual Threshold: ±2.0°C</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          {SENSORS.slice(0, 6).map(s => <SensorResidualChart key={s.name} sensor={s} />)}
        </div>
      </div>
    </Layout>
  )
}
