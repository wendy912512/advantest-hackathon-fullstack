import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendChart } from "@/components/features/TrendChart";
import { IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";
import type { TrendSeries } from "@/lib/api";

const DIRECTION_LABEL: Record<string, string> = {
  UP: "持續上升",
  DOWN: "持續下降",
  SHIFT: "位移/超出管制界線",
  STABLE: "穩定",
};

export function TrendSeriesCard({ series }: { series: TrendSeries }) {
  const hasAlert = series.alerts.length > 0;

  return (
    <Card className={hasAlert ? "border-destructive/60 bg-destructive/5" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">
          Site {series.site} · {series.testSuiteName}
        </CardTitle>
        {hasAlert ? (
          <Badge variant="destructive" className="gap-1">
            <IconAlertTriangle className="size-3.5" />
            {series.alerts.length} 個告警
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 text-emerald-700 dark:text-emerald-400">
            <IconCircleCheck className="size-3.5" />
            穩定
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <TrendChart series={series} />
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <span>Baseline Mean：{series.baselineMean}</span>
          <span>UCL：{series.ucl}</span>
          <span>LCL：{series.lcl}</span>
        </div>
        {hasAlert && (
          <ul className="space-y-1.5">
            {series.alerts.map((alert) => (
              <li key={alert.id} className="text-sm">
                <span className="font-medium text-destructive">
                  [{DIRECTION_LABEL[alert.direction] ?? alert.direction}]
                </span>{" "}
                <span className="text-muted-foreground">{alert.message}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
