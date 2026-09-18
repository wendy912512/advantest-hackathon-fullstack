import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LotListItem } from "@/lib/api";

export function LotListTable({ lots }: { lots: LotListItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lot</TableHead>
          <TableHead>開始時間</TableHead>
          <TableHead>Wafer 數</TableHead>
          <TableHead>總 Device 數</TableHead>
          <TableHead>Pass Rate</TableHead>
          <TableHead>狀態</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lots.map((lot) => (
          <TableRow key={lot.lot}>
            <TableCell className="font-medium">
              <Link href={`/lots/${lot.lot}`} className="hover:underline">
                {lot.lot}
              </Link>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {new Date(lot.startedAt).toLocaleString()}
            </TableCell>
            <TableCell>{lot.waferCount}</TableCell>
            <TableCell>{lot.totalDevices}</TableCell>
            <TableCell>{(lot.passRate * 100).toFixed(1)}%</TableCell>
            <TableCell>
              {lot.hasIssue ? (
                <Badge variant="destructive">疑似問題</Badge>
              ) : (
                <Badge variant="secondary" className="text-emerald-700 dark:text-emerald-400">
                  正常
                </Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
