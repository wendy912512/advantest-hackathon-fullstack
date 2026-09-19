import { useMemo } from "react";
import type { DashboardSnapshot, LotListItem } from "@/lib/api";

// mock 資料裡「目前正在測試中」的即時 lot（LOT-2026-0093）跟歷史批次列表
// （LOT_DEFINITIONS，見 frontend/src/lib/api/mock.ts 註解）是故意分開的兩組
// 資料，不會出現在同一份清單裡；但使用者在 Sites/Thermal 頁的下拉選單裡
// 應該要能選回「目前即時」這個選項。真實後端不會有這個問題（/api/lots 本
// 來就是把所有已收到的 device 依 lot 分組，即時的 lot 自然包含在裡面），
// 這裡只是把即時 lot 併進清單最前面，讓兩種資料來源在 UI 上表現一致。
export function useFilterableLots(lots: LotListItem[] | null, dashboard: DashboardSnapshot | null): LotListItem[] {
  return useMemo(() => {
    const list = lots ?? [];
    if (!dashboard) return list;
    if (list.some((l) => l.lot === dashboard.currentLot)) return list;
    const liveLot: LotListItem = {
      lot: dashboard.currentLot,
      waferCount: 1,
      totalDevices: dashboard.totalDevicesTested,
      passRate: dashboard.overallPassRate,
      hasIssue: dashboard.siteSummaries.some((s) => s.isAnomalous),
      startedAt: dashboard.generatedAt,
    };
    return [liveLot, ...list];
  }, [lots, dashboard]);
}
