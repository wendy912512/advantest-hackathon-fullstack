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

export function RecentResultsTable({ results }: { results: DeviceTestResult[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>PID</TableHead>
          <TableHead>Site</TableHead>
          <TableHead>Test Suite</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>結果</TableHead>
          <TableHead>Test Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((r) => (
          <TableRow key={r.device.pid}>
            <TableCell className="font-mono text-xs">{r.device.pid}</TableCell>
            <TableCell>{r.device.site}</TableCell>
            <TableCell>
              {r.results[0]?.testSuiteName}
              {r.results[0]?.pinName ? ` (${r.results[0].pinName})` : ""}
            </TableCell>
            <TableCell>
              {r.results[0]?.value} {r.results[0]?.unit}
            </TableCell>
            <TableCell>
              <Badge variant={r.device.pf === "PASS" ? "secondary" : "destructive"}>
                {r.device.pf}
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {new Date(r.device.testTime).toLocaleTimeString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
