"use client";

import { useWaferMapData } from "@/hooks/useWaferMapData";
import { WaferMapChart } from "@/components/features/WaferMapChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function WaferMapPage() {
  const { data, isLoading } = useWaferMapData();

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-muted-foreground">載入 wafer map 資料中…</p>
      </div>
    );
  }

  const failCount = data.points.filter((p) => p.pf === "FAIL").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold">Wafer Map 熱區圖</h1>
        <p className="text-sm text-muted-foreground">
          {data.lot} · {data.wafer}，共 {data.points.length} 顆 device，{failCount} 顆 FAIL（每 15
          秒重新評估，目前為 Mock 資料，且刻意模擬邊緣失敗率較高的 edge die effect 示範異常樣式）
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">晶圓分布</CardTitle>
          </CardHeader>
          <CardContent>
            <WaferMapChart data={data} />
            <div className="mt-4 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full bg-primary opacity-35" />
                PASS
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full bg-destructive" />
                FAIL
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">觀察重點</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              若不良點集中在特定區域（邊緣、中心、環狀、局部群聚），可能代表製程或機台的系統性問題，而非隨機缺陷。
            </p>
            <p>
              這份 demo 資料刻意讓晶圓邊緣區域的失敗率提高，模擬業界常見的 <b>edge die effect</b>
              （邊緣效應）樣式，方便展示空間異常的視覺化效果。
            </p>
            <p className="text-xs">
              真實座標系統、notch 方向與晶圓尺寸需與工程師確認（見 Notion 對齊表）。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
