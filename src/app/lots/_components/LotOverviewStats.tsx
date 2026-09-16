import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LotSummary } from "@/lib/api";

export function LotOverviewStats({ summary }: { summary: LotSummary }) {
  const stats = [
    { label: "Lot", value: summary.lot },
    { label: "Wafer", value: summary.wafer },
    { label: "總測試 Device 數", value: summary.totalDevices.toLocaleString() },
    { label: "整體 Pass Rate", value: `${(summary.passRate * 100).toFixed(1)}%` },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              {stat.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
