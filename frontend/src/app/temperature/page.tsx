"use client";

import { useTemperatureSnapshot } from "@/hooks/useTemperatureSnapshot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemperatureCard } from "./_components/TemperatureCard";
import { MachineNotificationLog } from "./_components/MachineNotificationLog";

export default function TemperaturePage() {
  const { snapshot, isLoading } = useTemperatureSnapshot();

  if (isLoading || !snapshot) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-muted-foreground">載入溫度預測資料中…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold">IC 溫度預測（場景二）</h1>
        <p className="text-sm text-muted-foreground">
          模擬量產情境下預測 IC 溫度，超出門檻時通知機台軟體（每 5 秒重新評估，目前為架構雛形：
          用量測值與溫度的簡化線性關係示範資料流程，尚未串接真實模型或官方提供的 CSV
          資料集，見 Notion 對齊表）
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {snapshot.predictions.map((p) => (
          <TemperatureCard key={p.site} prediction={p} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">機台軟體通知紀錄</CardTitle>
          <p className="text-xs text-muted-foreground">
            模擬透過 ONEAPI 的控制通道（如 sendCommand()）把預測結果回傳給測試機台軟體
          </p>
        </CardHeader>
        <CardContent>
          <MachineNotificationLog notifications={snapshot.notifications} />
        </CardContent>
      </Card>
    </div>
  );
}
