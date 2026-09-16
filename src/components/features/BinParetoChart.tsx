import type { BinBreakdown } from "@/lib/api";

export function BinParetoChart({ breakdown }: { breakdown: BinBreakdown[] }) {
  const max = Math.max(...breakdown.map((b) => b.count), 1);

  return (
    <div className="space-y-2">
      {breakdown.map((b) => (
        <div key={b.bin} className="flex items-center gap-3 text-sm">
          <div className="w-32 shrink-0 truncate text-muted-foreground">
            Bin {b.bin} · {b.label}
          </div>
          <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
            <div
              className={b.bin === 1 ? "h-full bg-emerald-500" : "h-full bg-destructive"}
              style={{ width: `${(b.count / max) * 100}%` }}
            />
          </div>
          <div className="w-20 shrink-0 text-right text-muted-foreground">
            {b.count}（{(b.ratio * 100).toFixed(1)}%）
          </div>
        </div>
      ))}
    </div>
  );
}
