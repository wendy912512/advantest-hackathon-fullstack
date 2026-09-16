import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";
import type { TrendAlert } from "@/lib/api";

export function TrendAlertList({ alerts }: { alerts: TrendAlert[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">異常告警</CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconCircleCheck className="size-4 text-emerald-600" />
            目前沒有偵測到異常
          </p>
        ) : (
          <ul className="space-y-3">
            {alerts.map((alert) => (
              <li key={alert.id} className="flex items-start gap-2 text-sm">
                <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium">
                    Site {alert.site} · {alert.testSuiteName}
                  </p>
                  <p className="text-muted-foreground">{alert.message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
