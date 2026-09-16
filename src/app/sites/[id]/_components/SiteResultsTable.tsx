import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DeviceTestResult } from "@/lib/api";

export function SiteResultsTable({ results }: { results: DeviceTestResult[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>PID</TableHead>
          <TableHead>X / Y</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Soft Bin</TableHead>
          <TableHead>Hard Bin</TableHead>
          <TableHead>結果</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((r) => (
          <TableRow key={r.device.pid}>
            <TableCell className="font-mono text-xs">{r.device.pid}</TableCell>
            <TableCell>
              {r.device.x} / {r.device.y}
            </TableCell>
            <TableCell>{r.results[0]?.value}</TableCell>
            <TableCell>{r.device.softBin}</TableCell>
            <TableCell>{r.device.hardBin}</TableCell>
            <TableCell>
              <Badge variant={r.device.pf === "PASS" ? "secondary" : "destructive"}>
                {r.device.pf}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
