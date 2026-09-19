import type { LotListItem, WaferListItem } from "@/lib/api";
import { C, MONO } from "@/lib/theme";

function Select({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: C.surfaceVariant,
        borderRadius: 10,
        padding: "8px 14px",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "transparent",
          border: "none",
          fontFamily: MONO,
          fontSize: 14,
          fontWeight: 600,
          color: C.text,
          cursor: disabled ? "default" : "pointer",
          outline: "none",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// 共用的 Lot / Wafer 篩選器，Sites 頁跟 Thermal 頁用 lot+wafer 兩個下拉，
// Wafer Browser 頁只需要 lot（那頁的目的本來就是比較同一個 lot 裡的多片
// wafer，選了 wafer 反而沒意義）。
export function LotWaferFilter({
  lots,
  selectedLot,
  onSelectLot,
  wafers,
  selectedWafer,
  onSelectWafer,
}: {
  lots: LotListItem[];
  selectedLot: string;
  onSelectLot: (lot: string) => void;
  wafers?: WaferListItem[];
  selectedWafer?: string;
  onSelectWafer?: (wafer: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
      <Select
        label="Lot"
        value={selectedLot}
        onChange={onSelectLot}
        options={lots.map((l) => ({ value: l.lot, label: l.lot }))}
      />
      {wafers && onSelectWafer && (
        <Select
          label="Wafer"
          value={selectedWafer ?? ""}
          onChange={onSelectWafer}
          disabled={wafers.length === 0}
          options={wafers.map((w) => ({ value: w.wafer, label: w.wafer }))}
        />
      )}
    </div>
  );
}
