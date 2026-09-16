"use client";

import { useEffect, useState } from "react";
import type { FailureExplanation } from "@/lib/api";
import { fetchFailureExplanations } from "@/lib/api";

const POLL_INTERVAL_MS = 15_000;

export function useFailureExplanations() {
  const [explanations, setExplanations] = useState<FailureExplanation[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const data = await fetchFailureExplanations();
      if (!cancelled) {
        setExplanations(data);
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

  return { explanations, isLoading };
}
