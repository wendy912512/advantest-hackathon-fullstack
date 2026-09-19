import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconTemperature, IconTemperatureMinus, IconAlertTriangle } from "@tabler/icons-react";
import type { TemperaturePrediction } from "@/lib/api";

export function TemperatureCard({ prediction }: { prediction: TemperaturePrediction }) {
  const ratio = Math.min(prediction.predictedTempC / prediction.thresholdC, 1.3);

  return (
    <Card
      className={
        prediction.shouldNotify ? "border-destructive/60 bg-destructive/5" : undefined
      }
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Site {prediction.site}</CardTitle>
        {prediction.shouldNotify ? (
          <Badge variant="destructive" className="gap-1">
            <IconTemperature className="size-3.5" />
            已通知機台
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 text-emerald-700 dark:text-emerald-400">
            <IconTemperatureMinus className="size-3.5" />
            正常
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-3xl font-semibold">
          {prediction.predictedTempC}
          <span className="text-base font-normal text-muted-foreground">°C</span>
        </p>
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>通知門檻 {prediction.thresholdC}°C</span>
            <span>信心值 {(prediction.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={prediction.shouldNotify ? "h-full bg-destructive" : "h-full bg-primary"}
              style={{ width: `${Math.min(ratio * 100, 100)}%` }}
            />
          </div>
        </div>
        {prediction.shouldNotify && (
          <p className="flex items-start gap-1.5 text-xs text-destructive">
            <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            預測溫度超出門檻，已送出通知
          </p>
        )}
        <ul className="space-y-1 text-xs text-muted-foreground">
          {prediction.basis.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
