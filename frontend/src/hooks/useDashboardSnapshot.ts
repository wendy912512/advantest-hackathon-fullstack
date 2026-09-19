"use client";

import { useEffect, useState } from "react";
import type { DashboardSnapshot } from "@/lib/api";
import { fetchDashboardSnapshot } from "@/lib/api";

const POLL_INTERVAL_MS = 5000;

export function useDashboardSnapshot() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchDashboardSnapshot();
        if (!cancelled) {
          setSnapshot(data);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("暫時無法連線到後端服務，系統將自動重試。");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { snapshot, isLoading, error };
}
