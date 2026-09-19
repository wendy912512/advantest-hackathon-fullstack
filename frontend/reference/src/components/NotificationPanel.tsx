import { useState, useEffect } from 'react'
import { C } from '../shared'

const MONO = "'Roboto Mono', monospace"

type NotifSeverity = 'critical' | 'warning'
type NotifFilter = 'all' | 'critical' | 'warning'

interface NotifItem {
  id: string
  severity: NotifSeverity
  impactCount: number
  lot: string
  wafer: string
  site: number
  testItem: string
  rootCause: string
  time: string
  isNew: boolean
}

const NOTIFICATIONS: NotifItem[] = [
  {
    id: 'n1',
    severity: 'critical',
    impactCount: 18,
    lot: 'LOT-2026-0093',
    wafer: 'W03',
    site: 2,
    testItem: 'IDDQ',
    rootCause: 'Site 2 的平均值超過 baseline，偏移達 8.3 mA，觸發 SiteUnbalance 告警',
    time: '14:23:01',
    isNew: true,
  },
  {
    id: 'n2',
    severity: 'warning',
    impactCount: 12,
    lot: 'LOT-2026-0093',
    wafer: 'W09',
    site: 2,
    testItem: 'IDDQ',
    rootCause: '均值上升趨勢連續 6 點，已超出 UCL 控制線',
    time: '14:19:44',
    isNew: true,
  },
  {
    id: 'n3',
    severity: 'critical',
    impactCount: 24,
    lot: 'LOT-2026-0093',
    wafer: 'W01',
    site: 2,
    testItem: 'IDDQ',
    rootCause: '良率降至 75.1%，低於製程標準 80%，建議暫停生產',
    time: '14:15:22',
    isNew: false,
  },
  {
    id: 'n4',
    severity: 'warning',
    impactCount: 9,
    lot: 'LOT-2026-0093',
    wafer: 'W12',
    site: 1,
    testItem: 'IDDQ',
    rootCause: '標準差上升趨勢，製程穩定性下降，需確認探針接觸狀態',
    time: '14:08:17',
    isNew: false,
  },
]

function NotificationCard({ notif, isLatest, flash }: { notif: NotifItem; isLatest: boolean; flash: boolean }) {
  const isCritical = notif.severity === 'critical'
  const sevColor = isCritical ? C.red : '#E65100'
  const sevBg    = isCritical ? C.redBg : '#FFF3E0'
  const sevBorder = isCritical ? C.redBorder : '#FFCCAA'
  const sevLabel = isCritical ? 'Critical' : 'Warning'
  const sevIcon  = isCritical ? '⊗' : '⚠'

  return (
    <div style={{
      background: isLatest && flash ? sevBg : C.card,
      borderRadius: 12,
      border: `1px solid ${isLatest ? sevBorder : C.border}`,
      padding: '14px 16px',
      marginBottom: 10,
      boxShadow: isLatest ? `${C.shadowMd}, 0 0 0 1px ${sevBorder}` : C.shadow,
      transition: 'background 0.5s, border-color 0.3s',
    }}>
      {/* Row 1: severity icon + label + impact + unread dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: sevBg, border: `2px solid ${sevBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 15, color: sevColor, fontWeight: 700 }}>{sevIcon}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: sevColor }}>{sevLabel}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: C.muted }}>影響</span>
              <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: sevColor }}>{notif.impactCount} 顆</span>
              {notif.isNew && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.blue, display: 'block', flexShrink: 0 }} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.text, fontWeight: 500 }}>{notif.lot}</span>
        <span style={{ color: C.dim, fontSize: 13 }}>›</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.text, fontWeight: 500 }}>Wafer {notif.wafer}</span>
        <span style={{ color: C.dim, fontSize: 13 }}>›</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.text, fontWeight: 500 }}>Site {notif.site}</span>
      </div>

      {/* Test item */}
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: C.muted }}>測試項目：</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.sub, fontFamily: MONO }}>{notif.testItem}</span>
      </div>

      {/* Root cause block */}
      <div style={{ background: C.surfaceVariant, borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', marginBottom: 5 }}>異常原因</div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{notif.rootCause}</div>
      </div>

      {/* Footer: timestamp */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>{notif.time}</span>
      </div>
    </div>
  )
}

export default function NotificationPanel({ tick }: { tick: number }) {
  const [filter, setFilter] = useState<NotifFilter>('all')
  const [latestIdx, setLatestIdx] = useState(0)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    setFlash(true)
    setLatestIdx(prev => (prev + 1) % NOTIFICATIONS.length)
    const t = setTimeout(() => setFlash(false), 800)
    return () => clearTimeout(t)
  }, [tick])

  const filtered = filter === 'all' ? NOTIFICATIONS : NOTIFICATIONS.filter(n => n.severity === filter)
  const critCount = NOTIFICATIONS.filter(n => n.severity === 'critical').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Panel header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 2 }}>CP 即時通知</div>
            <div style={{ fontSize: 12, color: C.muted }}>{NOTIFICATIONS.length} 筆異常事件</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: C.red, display: 'block' }} />
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, background: C.red, color: '#fff', padding: '3px 10px', borderRadius: 100 }}>{critCount}</span>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 4, padding: 4, background: C.surfaceVariant, borderRadius: 10 }}>
          {(['all', 'critical', 'warning'] as const).map(f => {
            const labels: Record<NotifFilter, string> = { all: '全部', critical: '嚴重', warning: '警告' }
            const active = filter === f
            return (
              <button key={f} onClick={() => setFilter(f)}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400, background: active ? C.card : 'transparent', color: active ? C.text : C.muted, boxShadow: active ? C.shadow : 'none', transition: 'all 0.15s' }}>
                {labels[f]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Card list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: C.muted, fontSize: 14 }}>無此類別通知</div>
        ) : (
          filtered.map((n, i) => (
            <NotificationCard key={n.id} notif={n} isLatest={i === latestIdx % filtered.length} flash={flash} />
          ))
        )}
      </div>
    </div>
  )
}
