import { Badge } from "@/components/ui/badge";
import { IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";

export function AnomalyBadge({ isAnomalous }: { isAnomalous: boolean }) {
  if (isAnomalous) {
    return (
      <Badge variant="destructive" className="gap-1">
        <IconAlertTriangle className="size-3.5" />
        異常
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-emerald-700 dark:text-emerald-400">
      <IconCircleCheck className="size-3.5" />
      正常
    </Badge>
  );
}
