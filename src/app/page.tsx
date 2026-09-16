"use client";

import { useDashboardSnapshot } from "@/hooks/useDashboardSnapshot";
import { SiteSummaryCard } from "@/components/features/SiteSummaryCard";
import { OverviewStats } from "@/app/_components/OverviewStats";
import { TrendAlertList } from "@/app/_components/TrendAlertList";
import { RecentResultsTable } from "@/app/_components/RecentResultsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const { snapshot, isLoading } = useDashboardSnapshot();

  if (isLoading || !snapshot) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-muted-foreground">載入即時測試資料中…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold">即時異常監控面板</h1>
        <p className="text-sm text-muted-foreground">
          最後更新：{new Date(snapshot.generatedAt).toLocaleTimeString()}（每 5 秒自動刷新，目前為 Mock 資料）
        </p>
      </div>

      <OverviewStats snapshot={snapshot} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-sm font-medium text-muted-foreground">各 Site 分布狀態</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {snapshot.siteSummaries.map((summary) => (
              <SiteSummaryCard key={summary.site} summary={summary} />
            ))}
          </div>
        </div>
        <TrendAlertList alerts={snapshot.trendAlerts} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">最新測試結果</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentResultsTable results={snapshot.recentResults} />
        </CardContent>
      </Card>
    </div>
  );
}
