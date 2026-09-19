import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchLotSummary } from "@/lib/api";
import { LotOverviewStats } from "../_components/LotOverviewStats";
import { SuspectIssuesList } from "../_components/SuspectIssuesList";
import { BinParetoChart } from "@/components/features/BinParetoChart";
import { SiteSummaryCard } from "@/components/features/SiteSummaryCard";
import { WaferGrid } from "./_components/WaferGrid";

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ lot: string }>;
}) {
  const { lot } = await params;
  const summary = await fetchLotSummary(lot);
  if (!summary) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <Link
        href="/lots"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="size-4" />
        返回批次列表
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{summary.lot} 批次品質摘要</h1>
        <p className="text-sm text-muted-foreground">
          彙總這一批（{summary.waferCount} 片 wafer）的整體 pass rate、bin 分布與疑似問題（目前為
          Mock 資料）
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

      <WaferGrid lot={summary.lot} wafers={summary.wafers} />

      <div className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          各 Site 分布狀態（整批彙總）
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {summary.siteSummaries.map((s) => (
            <SiteSummaryCard key={s.site} summary={s} href={null} />
          ))}
        </div>
      </div>
    </div>
  );
}
