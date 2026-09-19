import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";

export function SuspectIssuesList({ issues }: { issues: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">疑似問題清單</CardTitle>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconCircleCheck className="size-4 text-emerald-600" />
            目前沒有偵測到疑似問題
          </p>
        ) : (
          <ul className="space-y-2">
            {issues.map((issue) => (
              <li key={issue} className="flex items-start gap-2 text-sm">
                <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span className="text-muted-foreground">{issue}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
