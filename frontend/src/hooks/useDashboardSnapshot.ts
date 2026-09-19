"use client";

import { useEffect, useState } from "react";
import type { DashboardSnapshot } from "@/lib/api";
import { fetchDashboardSnapshot } from "@/lib/api";

const POLL_INTERVAL_MS = 5000;

export function useDashboardSnapshot() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const data = await fetchDashboardSnapshot();
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
