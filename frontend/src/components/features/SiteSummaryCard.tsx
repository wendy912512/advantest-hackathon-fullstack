import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AnomalyBadge } from "@/components/features/AnomalyBadge";
import type { SiteSummary } from "@/lib/api";

// href 預設連到即時監控的 Site 詳情頁；傳 null 表示這個情境沒有對應的 drill-down
// 頁面（例如批次瀏覽頁面裡彙總的 site 卡片，跟即時監控是不同資料來源），就不做成連結
export function SiteSummaryCard({
  summary,
  href,
}: {
  summary: SiteSummary;
  href?: string | null;
}) {
  const resolvedHref = href === undefined ? `/sites/${summary.site}` : href;

  const card = (
    <Card
      className={
        summary.isAnomalous
          ? "border-destructive/60 bg-destructive/5 transition-colors hover:border-destructive"
          : "transition-colors hover:border-primary/50"
      }
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Site {summary.site}</CardTitle>
        <AnomalyBadge isAnomalous={summary.isAnomalous} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">樣本數</p>
            <p className="font-medium">{summary.count}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Mean</p>
            <p className="font-medium">{summary.mean}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Std Dev</p>
            <p className="font-medium">{summary.stdDev}</p>
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Pass Rate</span>
            <span>{(summary.passRate * 100).toFixed(1)}%</span>
          </div>
          <Progress value={summary.passRate * 100} />
        </div>
        {summary.anomalyReason && (
          <p className="text-xs text-destructive">{summary.anomalyReason}</p>
        )}
      </CardContent>
    </Card>
  );

  return resolvedHref ? <Link href={resolvedHref}>{card}</Link> : card;
}
