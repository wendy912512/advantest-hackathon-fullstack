import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnomalyBadge } from "@/components/features/AnomalyBadge";
import { fetchSiteResults, fetchSiteSummaries } from "@/lib/api";
import { SiteResultsTable } from "./_components/SiteResultsTable";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const site = Number(id);
  if (!Number.isInteger(site)) {
    notFound();
  }

  const [summaries, results] = await Promise.all([
    fetchSiteSummaries(),
    fetchSiteResults(site),
  ]);

  const summary = summaries.find((s) => s.site === site);
  if (!summary) {
    notFound();
  }

  const otherSites = summaries.filter((s) => s.site !== site);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="size-4" />
        返回儀表板
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Site {summary.site} 詳細資訊</h1>
        <AnomalyBadge isAnomalous={summary.isAnomalous} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">樣本數</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.count}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">Pass Rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {(summary.passRate * 100).toFixed(1)}%
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">Mean</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.mean}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">Std Dev</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.stdDev}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">與其他 Site 比較（Imbalance 檢查）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {otherSites.map((other) => {
              const diff = summary.mean - other.mean;
              return (
                <div key={other.site} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">Site {other.site}</p>
                  <p className="text-muted-foreground">Mean: {other.mean}</p>
                  <p className={diff > 0.15 || diff < -0.15 ? "text-destructive" : "text-muted-foreground"}>
                    差異：{diff > 0 ? "+" : ""}
                    {diff.toFixed(3)}
                  </p>
                </div>
              );
            })}
          </div>
          {summary.anomalyReason && (
            <p className="mt-3 text-sm text-destructive">{summary.anomalyReason}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">測試結果明細</CardTitle>
        </CardHeader>
        <CardContent>
          <SiteResultsTable results={results} />
        </CardContent>
      </Card>
    </div>
  );
}
