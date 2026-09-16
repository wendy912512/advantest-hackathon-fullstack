# RTDI 即時異常監控 — 功能頁面總覽

> 用途：與組員對焦目前前端的開發進度與後續優先順序。資料來源：`WorkShop_Material.pdf`（Advantest 黑客松簡報）「適合黑客松的作品切入點」。

## 專案一句話總結

利用 ONEAPI 提供的即時測試資料（lot/wafer/site/test），做出能幫助測試工程師判斷問題的 Dashboard：接收資料 → 整理 → 找異常/趨勢 → 用 Dashboard 呈現 → 在模擬生產流程中展示持續更新。

---

## 已完成 ✅

| 頁面/功能 | 說明 | 檔案位置 |
| --- | --- | --- |
| 即時異常監控面板 | Lot/Wafer 概況、各 Site 分布卡片（mean/std/pass rate）、異常告警清單、最新測試結果表，5 秒輪詢模擬即時更新 | `src/app/page.tsx` |
| Site imbalance 偵測 | Site 詳情頁可比較與其他 site 的 mean 差異，超過閾值標紅示警 | `src/app/sites/[id]/page.tsx` |
| 測試趨勢預警 | 每個 site 建立 baseline（mean ± 3σ 為 UCL/LCL），偵測超出管制界線、連續上升/下降（≥6 點）、連續同側位移（8 點）。Dashboard 異常告警清單已改用真正的趨勢判斷結果 | `src/app/trends/page.tsx`、`src/lib/api/trends.ts` |
| 批次/晶圓品質摘要 | Lot/Wafer 層級的 pass rate、Soft/Hard Bin Pareto 圖、規則式疑似問題清單（site pass rate 過低、單一失敗 bin 佔比過高） | `src/app/lots/page.tsx`、`src/lib/api/lots.ts` |
| Wafer map 熱區圖 | 圓形晶圓分布圖，依 X/Y 座標畫出每顆 device 的 pass/fail，demo 資料刻意模擬邊緣失敗率較高的 edge die effect | `src/app/wafer-map/page.tsx`、`src/lib/api/wafer.ts` |
| 測試結果解釋器 | 把失敗 device 的測試欄位、bin、site 脈絡轉成工程師可讀的原因說明，目前為規則式文字模板 | `src/app/explainer/page.tsx`、`src/lib/api/explainer.ts` |

目前使用 Mock 資料層（`src/lib/api/mock.ts`）模擬 ONEAPI 事件，後端就緒後只需改 `src/lib/api/*.ts` 各功能檔案內部實作，其餘元件不需更動。

## 尚未開發 ❌

MVP 五大功能頁面（Dashboard、Site imbalance、趨勢預警、品質摘要、Wafer map、結果解釋器）皆已完成。後續可視需求擴充：Multi-parameter correlation 分析、Lot-to-lot variation 比較、更進階的 SPC 規則（Nelson rules 全套）、真正的模型推論取代規則式解釋器等。

---

## 測試異常種類對照表（設計 UX 時參考用）

| 分類 | 異常類型 | 說明 |
| --- | --- | --- |
| 空間類 | Site imbalance | 不同 site 分布明顯不同（已實作） |
| 空間類 | Wafer map pattern | 晶圓邊緣/中心/環狀不良集中（edge die effect、donut pattern、scratch pattern） |
| 空間類 | X/Y 座標群聚 | 不良 device 在座標上呈規律性群聚 |
| 時間趨勢類 | Trend（漂移） | 數值持續上升/下降，可能是機台老化、校正漂移 |
| 時間趨勢類 | Shift（位移） | 某時間點後平均值突然跳到新水準 |
| 時間趨勢類 | Variance change | 標準差突然變大，製程穩定性下降 |
| 時間趨勢類 | Cyclic pattern | 週期性起伏 |
| 數值/分布類 | Outlier | 單一 device 數值異常突出 |
| 數值/分布類 | Bimodal 分布 | 出現雙峰，可能混料或兩種製程狀態 |
| 數值/分布類 | Pass rate 驟降 | 良率突然下降 |
| 分類/Bin 類 | Bin distribution shift | Soft/Hard bin 分布比例改變 |
| 分類/Bin 類 | 新 bin 出現 | 出現過去沒有的失敗模式 |
| 關聯類（進階） | Multi-parameter correlation | 原本高度相關的測項相關性改變 |
| 關聯類（進階） | Lot-to-lot variation | 批次間差異超出合理範圍 |

---

## 介面設計參考

### 半導體測試/良率分析專用工具（最貼近本題）
- PDF Solutions Exensio — Wafer map、Bin map、SPC chart 呈現方式的業界範本
- yieldWerx / yieldHUB — Dashboard 版面配置（overview → drill-down）
- proteanTecs — AI-driven 異常偵測，anomaly 用顏色/信心分數呈現
- KLA Klarity — 圓形 wafer map 配色範本

### 通用即時監控 / Observability Dashboard（版面與告警呈現可借鏡）
- Grafana（grafana.com/grafana/dashboards 有公開範例）
- Datadog Anomaly Detection 的告警卡片、色彩分級（info/warning/critical）
- Elastic Observability / Kibana 的異常時間軸

### 統計製程管制（SPC）圖表範本
- Minitab、JMP 的 Control Chart（Google「control chart UCL LCL example」）

---

## 建議開發順序

1. ~~測試趨勢預警~~（已完成）
2. ~~批次/晶圓品質摘要~~（已完成）
3. ~~Wafer map 熱區圖~~（已完成）
4. ~~測試結果解釋器~~（已完成）

功能開發告一段落，下一步是 UI/UX 整合：先讓實際的測試工程師/懂半導體的組員試用一輪，觀察真實使用習慣，再決定哪些頁面該合併、導覽列怎麼重新編排。
