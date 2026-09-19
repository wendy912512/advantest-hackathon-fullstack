import type { MachineNotification, NotificationStatus } from "@/lib/api";
import { C, MONO } from "@/lib/theme";

const STATUS_STYLES: Record<NotificationStatus, { color: string; bg: string; border: string; label: string }> = {
  ACKNOWLEDGED: { color: C.green, bg: C.greenBg, border: C.greenBorder, label: "Confirmed" },
  SENT: { color: C.blue, bg: C.blueBg, border: "#BFDBFE", label: "Sent" },
  PENDING: { color: C.yellow, bg: C.yellowBg, border: C.yellowBorder, label: "Pending" },
};

export function NotificationLog({ notifications }: { notifications: MachineNotification[] }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", boxShadow: C.shadow }}>
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: C.red, display: "block", flexShrink: 0 }} />
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", color: C.muted }}>MACHINE NOTIFICATION LOG</span>
      </div>
      {notifications.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 16px", color: C.muted, fontSize: 13, background: C.card }}>目前沒有通知紀錄</div>
      ) : (
        notifications.map((ev, i) => {
          const sc = STATUS_STYLES[ev.status];
          return (
            <div
              key={ev.id}
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                padding: "10px 16px",
                borderBottom: i < notifications.length - 1 ? `1px solid ${C.borderLight}` : "none",
                background: C.card,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted, flexShrink: 0 }}>{new Date(ev.sentAt).toLocaleTimeString("en-GB")}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, padding: "2px 10px", borderRadius: 100, background: C.surfaceVariant, color: C.sub, flexShrink: 0 }}>Site {ev.site}</span>
              <span style={{ fontSize: 13, color: C.sub, flex: 1 }}>{ev.action}</span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 10px",
                  borderRadius: 100,
                  background: sc.bg,
                  color: sc.color,
                  border: `1px solid ${sc.border}`,
                  flexShrink: 0,
                }}
              >
                {sc.label}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
