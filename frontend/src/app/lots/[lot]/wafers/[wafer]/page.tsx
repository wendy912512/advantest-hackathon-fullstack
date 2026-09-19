import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWaferMapData } from "@/lib/api";
import { WaferMapChart } from "@/components/features/WaferMapChart";

export default async function WaferDetailPage({
  params,
}: {
  params: Promise<{ lot: string; wafer: string }>;
}) {
  const { lot, wafer } = await params;
  const data = await fetchWaferMapData(lot, wafer);
  if (!data) {
    notFound();
  }

  const failCount = data.points.filter((p) => p.pf === "FAIL").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <Link
        href={`/lots/${lot}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="size-4" />
        返回 {lot} 批次摘要
      </Link>

      <div>
        <h1 className="text-xl font-semibold">
          {data.lot} · {data.wafer} Wafer Map
        </h1>
        <p className="text-sm text-muted-foreground">
          共 {data.points.length} 顆 device，{failCount} 顆 FAIL（目前為 Mock 資料）
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
            <p className="text-xs">
              真實座標系統、notch 方向與晶圓尺寸需與工程師確認（見 Notion 對齊表）。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
