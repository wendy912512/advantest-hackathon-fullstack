import { C } from "@/lib/theme";

export function SectionHeader({ id, label, count }: { id: string; label: string; count?: number }) {
  return (
    <div id={id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, scrollMarginTop: 72 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: C.muted,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {count !== undefined && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            background: C.surfaceVariant,
            color: C.muted,
            borderRadius: 100,
            padding: "2px 8px",
          }}
        >
          {count}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}
