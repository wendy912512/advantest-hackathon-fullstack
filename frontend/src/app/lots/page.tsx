import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchLotList } from "@/lib/api";
import { LotListTable } from "./_components/LotListTable";

export default async function LotsPage() {
  const lots = await fetchLotList();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold">批次列表</h1>
        <p className="text-sm text-muted-foreground">
          依 Lot（批）瀏覽品質——先看整批的彙總良率，點進去可以看該批的 bin 分布、疑似問題，並選
          wafer 看熱區圖（目前為 Mock 資料）
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">所有 Lot</CardTitle>
        </CardHeader>
        <CardContent>
          <LotListTable lots={lots} />
        </CardContent>
      </Card>
    </div>
  );
}
