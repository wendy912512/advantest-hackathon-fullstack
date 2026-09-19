"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { DashboardSnapshot, FailureExplanation, LotListItem, WaferThermal } from "@/lib/api";
import { fetchDashboardSnapshot, fetchFailureExplanations, fetchLotList, fetchWaferThermal } from "@/lib/api";

// 整個 app 共用的資料來源：抽離出來變成一個 provider，是因為右側警告欄現在
// 要「不管切到哪一頁都固定顯示」（見使用者需求），不能再像之前那樣讓每個
// page.tsx 各自 fetch 一份自己的 dashboard/temperature 資料——那樣切頁面時
// 警告欄會被卸載重掛，資料來源也會分散成好幾份不同步的 fetch。
interface AppData {
  dashboard: DashboardSnapshot | null;
  // 目前正在測試的那片 wafer 的 per-device sensor 預測（右側警告欄用；不管使用者
  // 在頁面上篩選哪個 lot/wafer，警告欄永遠看即時這一片）
  liveThermal: WaferThermal | null;
  lots: LotListItem[] | null;
  failures: FailureExplanation[] | null;
  isLoading: boolean;
  tick: number;
  lastUpdate: string;
}

const AppDataContext = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData() 必須在 <AppDataProvider> 裡面使用");
  return ctx;
}

const DASHBOARD_POLL_MS = 5000;
const TEMPERATURE_POLL_MS = 5000;
const LOTS_POLL_MS = 15000;
const FAILURES_POLL_MS = 15000;

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);
  const [liveThermal, setLiveThermal] = useState<WaferThermal | null>(null);
  const [lots, setLots] = useState<LotListItem[] | null>(null);
  const [failures, setFailures] = useState<FailureExplanation[] | null>(null);
  const [tick, setTick] = useState(0);
  const prevGeneratedAt = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await fetchDashboardSnapshot();
      if (!cancelled) setDashboard(data);
    }
    load();
    const interval = setInterval(load, DASHBOARD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const liveLot = dashboard?.currentLot;
  const liveWafer = dashboard?.currentWafer;
  useEffect(() => {
    if (!liveLot || !liveWafer) return;
    let cancelled = false;
    async function load() {
      const data = await fetchWaferThermal(liveLot!, liveWafer!);
      if (!cancelled) setLiveThermal(data ?? null);
    }
    load();
    const interval = setInterval(load, TEMPERATURE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [liveLot, liveWafer]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await fetchLotList();
      if (!cancelled) setLots(data);
    }
    load();
    const interval = setInterval(load, LOTS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await fetchFailureExplanations();
      if (!cancelled) setFailures(data);
    }
    load();
    const interval = setInterval(load, FAILURES_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (dashboard && dashboard.generatedAt !== prevGeneratedAt.current) {
      prevGeneratedAt.current = dashboard.generatedAt;
      setTick((t) => t + 1);
    }
  }, [dashboard]);

  const isLoading = !dashboard;
  const lastUpdate = dashboard ? new Date(dashboard.generatedAt).toLocaleTimeString("en-GB") : "--:--:--";

  return (
    <AppDataContext.Provider value={{ dashboard, liveThermal, lots, failures, isLoading, tick, lastUpdate }}>
      {children}
    </AppDataContext.Provider>
  );
}
