"use client";

import { useEffect, useState } from "react";
import type { LotListItem } from "@/lib/api";
import { fetchLotList } from "@/lib/api";

const POLL_INTERVAL_MS = 15_000;

export function useLotList() {
  const [lots, setLots] = useState<LotListItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const data = await fetchLotList();
      if (!cancelled) {
        setLots(data);
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

  return { lots, isLoading };
}
