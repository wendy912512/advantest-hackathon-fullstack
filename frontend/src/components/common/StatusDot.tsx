import { C, type SiteStatus } from "@/lib/theme";

export function StatusDot({ status, size = 7 }: { status: SiteStatus; size?: number }) {
  const color = status === "normal" ? C.greenDot : status === "warning" ? "#FFA726" : "#EF5350";
  return (
    <span
      style={{
        width: size,
        height: size,
        background: color,
        borderRadius: "50%",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}
