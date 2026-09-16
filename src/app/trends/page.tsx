"use client";

import { useTrendSeries } from "@/hooks/useTrendSeries";
import { TrendSeriesCard } from "./_components/TrendSeriesCard";

export default function TrendsPage() {
  const { series, isLoading } = useTrendSeries();

  if (isLoading || !series) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-muted-foreground">載入趨勢資料中…</p>
      </div>
    );
  }

  const alertCount = series.reduce((sum, s) => sum + s.alerts.length, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold">測試趨勢預警</h1>
        <p className="text-sm text-muted-foreground">
          每 10 秒重新評估一次（目前為 Mock 資料）。以每個 site 前 10 個量測點建立 baseline（mean ±
          3 個標準差為管制界線 UCL/LCL），偵測連續上升/下降（≥ 6 點）與整體位移（連續 8 點落在
          baseline 平均值同一側）。目前共 {alertCount} 個告警。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {series.map((s) => (
          <TrendSeriesCard key={s.site} series={s} />
        ))}
      </div>
    </div>
  );
}
