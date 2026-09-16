"use client";

import { useEffect, useState } from "react";
import type { LotSummary } from "@/lib/api";
import { fetchLotSummary } from "@/lib/api";

const POLL_INTERVAL_MS = 15_000;

export function useLotSummary() {
  const [summary, setSummary] = useState<LotSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const data = await fetchLotSummary();
      if (!cancelled) {
        setSummary(data);
        setIsLoading(false);
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { summary, isLoading };
}
