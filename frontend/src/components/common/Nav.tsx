"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { C } from "@/lib/theme";

export const NAV_ITEMS = [
  { id: "s1", label: "Sites", icon: "◈", anchor: "#s1", page: false },
  { id: "s5", label: "Thermal", icon: "◉", anchor: "/temperature", page: true },
] as const;

function isActive(item: (typeof NAV_ITEMS)[number], onThermal: boolean, activeSection: string) {
  return item.page ? onThermal : !onThermal && activeSection === item.id;
}

export function Sidebar({ activeSection }: { activeSection: string }) {
  const pathname = usePathname();
  const onThermal = pathname === "/temperature";

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
        const active = isActive(item, onThermal, activeSection);
        const railItem = (
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
              <span style={{ fontSize: 16, color: active ? C.blue : C.muted }}>{item.icon}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? C.text : C.muted, textAlign: "center", userSelect: "none" }}>
              {item.label}
            </span>
          </div>
        );
        return item.page ? (
          <Link key={item.id} href={item.anchor} style={{ textDecoration: "none", width: "100%" }}>
            {railItem}
          </Link>
        ) : (
          <a key={item.id} href={onThermal ? `/${item.anchor}` : item.anchor} style={{ textDecoration: "none", width: "100%" }}>
            {railItem}
          </a>
        );
      })}
    </nav>
  );
}

export function MobileBottomNav({ activeSection }: { activeSection: string }) {
  const pathname = usePathname();
  const onThermal = pathname === "/temperature";

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex"
      style={{ background: C.card, borderTop: `1px solid ${C.border}`, boxShadow: "0 -2px 8px rgba(0,0,0,0.08)", height: 64 }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item, onThermal, activeSection);
        const content = (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 0" }}>
            <div style={{ width: 56, height: 32, borderRadius: 16, background: active ? C.blueBg : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 17, color: active ? C.blue : C.muted }}>{item.icon}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? C.text : C.muted }}>{item.label}</span>
          </div>
        );
        return item.page ? (
          <Link key={item.id} href={item.anchor} className="flex-1 flex items-center justify-center" style={{ textDecoration: "none" }}>
            {content}
          </Link>
        ) : (
          <a key={item.id} href={onThermal ? `/${item.anchor}` : item.anchor} className="flex-1 flex items-center justify-center" style={{ textDecoration: "none" }}>
            {content}
          </a>
        );
      })}
    </nav>
  );
}
