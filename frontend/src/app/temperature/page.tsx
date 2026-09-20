"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/components/providers/AppDataProvider";
import { useFilterableLots } from "@/hooks/useFilterableLots";
import type { LotSummary, ThermalValidationReport, WaferListItem, WaferThermal } from "@/lib/api";
import { fetchLotSummary, fetchThermalValidationReport, fetchWaferThermal } from "@/lib/api";
import { LotWaferFilter } from "@/components/common/LotWaferFilter";
import { ThermalValidationReportView } from "@/components/temperature/ThermalValidationReport";
import { WaferThermalView } from "@/components/temperature/WaferThermalView";
import { C, MONO } from "@/lib/theme";

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
  const [validationReport, setValidationReport] = useState<ThermalValidationReport | undefined>(undefined);
  const [view, setView] = useState<"prediction" | "validation">("prediction");

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

  useEffect(() => {
    let cancelled = false;
    fetchThermalValidationReport().then((report) => {
      if (!cancelled) setValidationReport(report);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: C.blue, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 7 }}>THERMAL PREDICTION</div>
        <h1 style={{ color: C.text, fontSize: 25, fontWeight: 650, letterSpacing: "-0.02em", margin: 0 }}>Thermal 預測</h1>
        <p style={{ color: C.muted, fontSize: 13, margin: "7px 0 0" }}>比較各個 sensor 的預測值與實測值，提前標示可能超過溫度上限的 Device。</p>
      </div>
      <LotWaferFilter
        lots={lots}
        selectedLot={selectedLot}
        onSelectLot={handleLotChange}
        wafers={waferOptions}
        selectedWafer={selectedWafer}
        onSelectWafer={setSelectedWafer}
      />

      <div style={{ fontSize: 12, marginBottom: 12, color: C.muted }}>
        {isLive
          ? "目前測試中的 wafer：已實測的 sensor 有預測與實際值，正要測的 sensor 只有預測（預測會超標會立刻通知到右側警告欄）。"
          : "非目前測試中的 wafer：顯示預測與正式測試結果，可以看預測準不準。"}
      </div>
      <div style={{ display: "flex", gap: 4, padding: 4, background: C.surfaceVariant, borderRadius: 10, width: "fit-content", marginBottom: 16 }}>
        {(["prediction", "validation"] as const).map((item) => {
          const active = view === item;
          return (
            <button key={item} type="button" onClick={() => setView(item)} style={{ padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400, background: active ? C.card : "transparent", color: active ? C.text : C.muted, boxShadow: active ? C.shadow : "none" }}>
              {item === "prediction" ? "即時預測" : "模型驗證"}
            </button>
          );
        })}
      </div>

      {view === "validation" ? (
        validationReport ? (
          <ThermalValidationReportView report={validationReport} />
        ) : (
          <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "32px 20px", textAlign: "center", color: C.muted, fontSize: 13, background: C.card }}>
            尚未取得模型驗證報告。請先在後端執行 <code>python backend/scripts/validate_thermal_model.py</code> 產生報告。
          </div>
        )
      ) : data ? (
        <WaferThermalView key={`${data.lot}/${data.wafer}/${data.isLive}`} data={data} />
      ) : (
        <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "32px 20px", textAlign: "center", color: C.muted, fontSize: 13, background: C.card }}>
          {selectedWafer ? `${selectedLot} / ${selectedWafer} 沒有 sensor 預測資料，或仍在載入中。` : "請選擇 wafer。"}
        </div>
      )}
    </div>
  );
}
