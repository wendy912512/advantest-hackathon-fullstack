import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSnapshot } from "@/lib/api";

export function OverviewStats({ snapshot }: { snapshot: DashboardSnapshot }) {
  const stats = [
    { label: "目前 Lot", value: snapshot.currentLot },
    { label: "目前 Wafer", value: snapshot.currentWafer },
    { label: "已測試 Device 數", value: snapshot.totalDevicesTested.toLocaleString() },
    { label: "整體 Pass Rate", value: `${(snapshot.overallPassRate * 100).toFixed(1)}%` },
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
