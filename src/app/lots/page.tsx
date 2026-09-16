"use client";

import { useLotSummary } from "@/hooks/useLotSummary";
import { LotOverviewStats } from "./_components/LotOverviewStats";
import { SuspectIssuesList } from "./_components/SuspectIssuesList";
import { SiteSummaryCard } from "@/components/features/SiteSummaryCard";
import { BinParetoChart } from "@/components/features/BinParetoChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LotsPage() {
  const { summary, isLoading } = useLotSummary();

  if (isLoading || !summary) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-muted-foreground">載入批次品質資料中…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold">批次/晶圓品質摘要</h1>
        <p className="text-sm text-muted-foreground">
          以目前 Lot/Wafer 為層級彙總 pass rate、bin 分布與疑似問題（每 15 秒重新評估，目前為 Mock
          資料）
        </p>
      </div>

      <LotOverviewStats summary={summary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Soft Bin 分布（Pareto）</CardTitle>
          </CardHeader>
          <CardContent>
            <BinParetoChart breakdown={summary.softBinBreakdown} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hard Bin 分布（Pareto）</CardTitle>
          </CardHeader>
          <CardContent>
            <BinParetoChart breakdown={summary.hardBinBreakdown} />
          </CardContent>
        </Card>
      </div>

      <SuspectIssuesList issues={summary.suspectIssues} />

      <div className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">各 Site 分布狀態</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {summary.siteSummaries.map((s) => (
            <SiteSummaryCard key={s.site} summary={s} />
          ))}
        </div>
      </div>
    </div>
  );
}
