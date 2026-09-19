"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/components/providers/AppDataProvider";
import { useFilterableLots } from "@/hooks/useFilterableLots";
import type { LotSummary, WaferListItem, WaferThermal } from "@/lib/api";
import { fetchLotSummary, fetchWaferThermal } from "@/lib/api";
import { LotWaferFilter } from "@/components/common/LotWaferFilter";
import { WaferThermalView } from "@/components/temperature/WaferThermalView";
import { C } from "@/lib/theme";

// 選到「目前正在測試的 lot/wafer」→ 看最即時的資料（預測進行中，實測尚未回來
// 的 sensor 只有預測）；選其他 wafer → 看預測 + 正式結果（實測已回來，可以驗證）。
export default function TemperaturePage() {
  const { dashboard, liveThermal, lots: rawLots } = useAppData();
  const lots = useFilterableLots(rawLots, dashboard);
  const [selectedLot, setSelectedLot] = useState(dashboard?.currentLot ?? "");
  const [selectedWafer, setSelectedWafer] = useState(dashboard?.currentWafer ?? "");
  const [lotSummary, setLotSummary] = useState<LotSummary | undefined>(undefined);
  const [otherThermal, setOtherThermal] = useState<WaferThermal | undefined>(undefined);
  const [loadedKey, setLoadedKey] = useState("");

  const isLive = dashboard != null && selectedLot === dashboard.currentLot && selectedWafer === dashboard.currentWafer;

  useEffect(() => {
    if (!selectedLot) return;
    let cancelled = false;
    fetchLotSummary(selectedLot).then((data) => {
      if (cancelled) return;
      setLotSummary(data);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedLot]);

  useEffect(() => {
    if (!selectedLot || !selectedWafer || isLive) return;
    let cancelled = false;
    fetchWaferThermal(selectedLot, selectedWafer).then((data) => {
      if (cancelled) return;
      setOtherThermal(data);
      setLoadedKey(`${selectedLot}/${selectedWafer}`);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedLot, selectedWafer, isLive]);

  const waferOptions: WaferListItem[] = useMemo(() => {
    const list = [...(lotSummary?.wafers ?? [])];
    if (dashboard && selectedLot === dashboard.currentLot && !list.some((w) => w.wafer === dashboard.currentWafer)) {
      list.unshift({ wafer: dashboard.currentWafer, totalDevices: 0, passRate: 0, hasIssue: false });
    }
    return list;
  }, [lotSummary, dashboard, selectedLot]);

  const handleLotChange = (lot: string) => {
    setSelectedLot(lot);
    if (dashboard && lot === dashboard.currentLot) setSelectedWafer(dashboard.currentWafer);
    else setSelectedWafer("");
  };

  // 換 lot 之後 wafer 還沒選：自動選第一片。
  useEffect(() => {
    if (!selectedWafer && waferOptions.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 換 lot 後自動帶入第一片 wafer
      setSelectedWafer(waferOptions[0].wafer);
    }
  }, [selectedWafer, waferOptions]);

  if (!dashboard) return null;

  const data = isLive ? liveThermal : loadedKey === `${selectedLot}/${selectedWafer}` ? otherThermal : undefined;

  return (
    <div>
      <LotWaferFilter
        lots={lots}
        selectedLot={selectedLot}
        onSelectLot={handleLotChange}
        wafers={waferOptions}
        selectedWafer={selectedWafer}
        onSelectWafer={setSelectedWafer}
      />

      <div style={{ fontSize: 12, marginBottom: 20, color: C.muted }}>
        {isLive
          ? "這是目前正在測試的 wafer：顯示最即時的資料——已實測的 sensor 有預測與實際值，正要測的下一個 sensor 只有預測（預測會超標會立刻通知到右側警告欄）。"
          : "這不是目前正在測試的 wafer：顯示預測與正式測試結果，可以看預測準不準。"}
      </div>

      {data ? (
        <WaferThermalView key={`${data.lot}/${data.wafer}/${data.isLive}`} data={data} />
      ) : (
        <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "32px 20px", textAlign: "center", color: C.muted, fontSize: 13, background: C.card }}>
          {selectedWafer ? `${selectedLot} / ${selectedWafer} 沒有 sensor 預測資料，或仍在載入中。` : "請選擇 wafer。"}
        </div>
      )}
    </div>
  );
}
