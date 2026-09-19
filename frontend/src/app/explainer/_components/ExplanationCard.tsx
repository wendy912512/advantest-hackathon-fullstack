import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconFileText } from "@tabler/icons-react";
import type { FailureExplanation } from "@/lib/api";

export function ExplanationCard({ explanation }: { explanation: FailureExplanation }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="font-mono text-sm">{explanation.pid}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Site {explanation.site} · {explanation.testSuiteName}
          </p>
        </div>
        <Badge variant="destructive">{explanation.binLabel}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="flex items-start gap-2 text-sm font-medium">
          <IconFileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {explanation.summary}
        </p>
        <ul className="space-y-1 pl-6 text-sm text-muted-foreground">
          {explanation.reasons.map((reason) => (
            <li key={reason} className="list-disc">
              {reason}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
