import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MachineNotification } from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  SENT: "已送出",
  ACKNOWLEDGED: "機台已回應",
  PENDING: "等待中",
};

export function MachineNotificationLog({
  notifications,
}: {
  notifications: MachineNotification[];
}) {
  if (notifications.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">目前沒有需要通知機台軟體的預測結果。</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Site</TableHead>
          <TableHead>預測溫度</TableHead>
          <TableHead>建議動作</TableHead>
          <TableHead>狀態</TableHead>
          <TableHead>送出時間</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {notifications.map((n) => (
          <TableRow key={n.id}>
            <TableCell>{n.site}</TableCell>
            <TableCell>{n.predictedTempC}°C</TableCell>
            <TableCell className="text-sm text-muted-foreground">{n.action}</TableCell>
            <TableCell>
              <Badge variant="secondary">{STATUS_LABEL[n.status] ?? n.status}</Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {new Date(n.sentAt).toLocaleTimeString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
