import type { SVGProps } from "react";

// 依 Tabler Icons 的規格自製（24x24 viewBox、outline、stroke-linecap/linejoin round、
// fill none、currentColor），介面跟 @tabler/icons-react 的圖示一致（size / stroke /
// color），可以直接和其他 Tabler 圖示混用。
// 造型：底部帶小「平邊（wafer flat）」的圓形晶圓，內部是 2x2 的晶粒（die）。
// 試過「圓形＋直橫線」的做法，縮小後看起來像地球，所以改用分開的方塊晶粒。
type IconWaferProps = Omit<SVGProps<SVGSVGElement>, "stroke" | "color"> & {
  size?: number | string;
  stroke?: number | string;
  color?: string;
};

export function IconWafer({ size = 24, stroke = 2, color = "currentColor", ...props }: IconWaferProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8.5 20.3a9 9 0 1 1 7 0z" />
      <rect x="7.5" y="7" width="4" height="4" rx=".5" />
      <rect x="12.5" y="7" width="4" height="4" rx=".5" />
      <rect x="7.5" y="12" width="4" height="4" rx=".5" />
      <rect x="12.5" y="12" width="4" height="4" rx=".5" />
    </svg>
  );
}
