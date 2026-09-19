import { useMemo } from "react";
import type { DashboardSnapshot, LotListItem } from "@/lib/api";

// 後端尚未回傳時，將目前 dashboard 的 Lot 暫時補進下拉選單；正式資料來源
// 會由 /api/lots 依 Lot 分組。CSV fallback 目前固定對齊 A12345/W01~W25。
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
