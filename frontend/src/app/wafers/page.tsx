"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/components/providers/AppDataProvider";
import { useFilterableLots } from "@/hooks/useFilterableLots";
import { LotWaferFilter } from "@/components/common/LotWaferFilter";
import { LotBrowser } from "@/components/dashboard/LotBrowser";
import { C } from "@/lib/theme";

// 這頁的目的是「比較同一個 lot 裡的多片 wafer」，所以只需要 lot 篩選器，
// 不需要 wafer（選了單一片就沒有「比較」的意義了）。
export default function WafersPage() {
  const { dashboard, lots: rawLots } = useAppData();
  const lots = useFilterableLots(rawLots, dashboard);
  const [selectedLot, setSelectedLot] = useState(dashboard?.currentLot ?? "");

  useEffect(() => {
    if (dashboard && !selectedLot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 資料到位後補上初始篩選值，屬於一次性初始化
      setSelectedLot(dashboard.currentLot);
    }
  }, [dashboard, selectedLot]);

  if (!dashboard || !selectedLot) {
    return <div style={{ color: C.muted, fontSize: 14 }}>載入批次資料中…</div>;
  }

  return (
    <div>
      <LotWaferFilter lots={lots} selectedLot={selectedLot} onSelectLot={setSelectedLot} />
      <LotBrowser lot={selectedLot} />
    </div>
  );
}
