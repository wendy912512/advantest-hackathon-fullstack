"use client";

import { useDashboardSnapshot } from "@/hooks/useDashboardSnapshot";
import { SiteSummaryCard } from "@/components/features/SiteSummaryCard";
import { OverviewStats } from "@/app/_components/OverviewStats";
import { TrendAlertList } from "@/app/_components/TrendAlertList";
import { RecentResultsTable } from "@/app/_components/RecentResultsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const { snapshot, isLoading, error } = useDashboardSnapshot();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-muted-foreground">載入即時測試資料中…</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">暫時無法取得即時資料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{error ?? "系統將自動重試。"}</p>
            <p>請確認後端服務是否已啟動；系統會每 5 秒重新嘗試連線。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold">即時異常監控面板</h1>
        <p className="text-sm text-muted-foreground">
          最後更新：{new Date(snapshot.generatedAt).toLocaleTimeString()}（每 5 秒自動更新）
        </p>
        {error ? <p className="mt-1 text-sm text-amber-700">{error}</p> : null}
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
