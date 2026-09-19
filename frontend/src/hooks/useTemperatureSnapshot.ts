"use client";

import { useEffect, useState } from "react";
import type { TemperatureSnapshot } from "@/lib/api";
import { fetchTemperatureSnapshot } from "@/lib/api";

const POLL_INTERVAL_MS = 5000;

export function useTemperatureSnapshot() {
  const [snapshot, setSnapshot] = useState<TemperatureSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const data = await fetchTemperatureSnapshot();
      if (!cancelled) {
        setSnapshot(data);
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

  return { snapshot, isLoading };
}
