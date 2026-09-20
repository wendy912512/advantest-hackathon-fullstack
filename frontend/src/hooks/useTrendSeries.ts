"use client";

import { useEffect, useState } from "react";
import type { TrendSeries } from "@/lib/api";
import { fetchTrendSeries } from "@/lib/api";

const POLL_INTERVAL_MS = 10_000;

export function useTrendSeries(lot?: string, wafer?: string, site?: number | null) {
  const [series, setSeries] = useState<TrendSeries[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!lot || !wafer) {
        if (!cancelled) {
          setSeries([]);
          setIsLoading(false);
        }
        return;
      }
      const data = await fetchTrendSeries(lot, wafer, site ?? undefined);
      if (!cancelled) {
        setSeries(data);
        setIsLoading(false);
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [lot, wafer, site]);

  return { series, isLoading };
}
