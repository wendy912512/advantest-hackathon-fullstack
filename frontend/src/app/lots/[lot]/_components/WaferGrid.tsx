import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconChevronRight } from "@tabler/icons-react";
import type { WaferListItem } from "@/lib/api";

export function WaferGrid({ lot, wafers }: { lot: string; wafers: WaferListItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Wafer 清單</CardTitle>
        <p className="text-xs text-muted-foreground">
          點一片 wafer 直接看熱區圖，不用手動拉資料畫圖
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {wafers.map((w) => (
            <Link key={w.wafer} href={`/lots/${lot}/wafers/${w.wafer}`}>
              <div
                className={
                  "flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:border-primary/50" +
                  (w.hasIssue ? " border-destructive/60 bg-destructive/5" : "")
                }
              >
                <div>
                  <p className="font-medium">{w.wafer}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.totalDevices} devices · {(w.passRate * 100).toFixed(1)}% pass
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {w.hasIssue && <Badge variant="destructive">疑似問題</Badge>}
                  <IconChevronRight className="size-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
