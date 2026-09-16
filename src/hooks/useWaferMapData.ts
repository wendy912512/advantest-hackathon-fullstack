"use client";

import { useEffect, useState } from "react";
import type { WaferMapData } from "@/lib/api";
import { fetchWaferMapData } from "@/lib/api";

const POLL_INTERVAL_MS = 15_000;

export function useWaferMapData() {
  const [data, setData] = useState<WaferMapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await fetchWaferMapData();
      if (!cancelled) {
        setData(result);
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

  return { data, isLoading };
}
