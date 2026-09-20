"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { C } from "@/lib/theme";
import { IconLayoutDashboard, IconTemperature } from "@tabler/icons-react";
import { IconWafer } from "./IconWafer";

// 三個都是真正的路由（不再是同一頁裡的錨點捲動），active 狀態直接比對
// pathname 就好，不需要像之前那樣用 IntersectionObserver 追蹤目前捲到哪個
// section。
export const NAV_ITEMS = [
  { href: "/", label: "Sites", Icon: IconLayoutDashboard },
  { href: "/wafers", label: "Wafers", Icon: IconWafer },
  { href: "/thermal", label: "Thermal", Icon: IconTemperature },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="hidden md:flex flex-col items-center pt-2 gap-0"
      style={{
        width: 80,
        background: C.card,
        borderRight: `1px solid ${C.border}`,
        position: "sticky",
        top: 56,
        height: "calc(100vh - 56px)",
        flexShrink: 0,
        overflowY: "auto",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || (item.href === "/thermal" && pathname === "/temperature");
        const Icon = item.Icon;
        return (
          <Link key={item.href} href={item.href} style={{ textDecoration: "none", width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px", width: "100%", cursor: "pointer" }}>
              <div
                style={{
                  width: 56,
                  height: 32,
                  borderRadius: 16,
                  background: active ? C.blueBg : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
              >
                <Icon size={17} stroke={1.8} color={active ? C.blue : C.muted} aria-hidden="true" />
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? C.text : C.muted, textAlign: "center", userSelect: "none" }}>
                {item.label}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex"
      style={{ background: C.card, borderTop: `1px solid ${C.border}`, boxShadow: "0 -2px 8px rgba(0,0,0,0.08)", height: 64 }}
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || (item.href === "/thermal" && pathname === "/temperature");
        const Icon = item.Icon;
        return (
          <Link key={item.href} href={item.href} className="flex-1 flex items-center justify-center" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 0" }}>
              <div style={{ width: 56, height: 32, borderRadius: 16, background: active ? C.blueBg : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={18} stroke={1.8} color={active ? C.blue : C.muted} aria-hidden="true" />
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? C.text : C.muted }}>{item.label}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
