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

目前使用 Mock 資料層（`src/lib/api/mock.ts`）模擬 ONEAPI 事件，後端就緒後只需改 `src/lib/api/dashboard.ts`、`src/lib/api/sites.ts` 內部實作，其餘元件不需更動。

## 尚未開發 ❌

| 優先序 | 頁面/功能 | 簡報原文說明 | 備註 |
| --- | --- | --- | --- |
| 1 | 測試趨勢預警 | 偵測數值持續上升/下降、標準差改變、或某時間點整體位移（trend issue） | 需要擴充 mock 資料產生「時間序列」而非單一快照；建議用 Control Chart（UCL/LCL）呈現 |
| 2 | 批次/晶圓品質摘要 | 以 lot、wafer、site 為層級產生 pass rate、bin 分布與疑似問題清單 | `LotSummary` 型別已在 `src/lib/api/types.ts` 定義，尚未接功能與頁面 |
| 3 | Wafer map 熱區圖 | 簡報未直接列為頁面，但資料含 X/Y 座標，適合做空間異常視覺化 | 圓形晶圓熱區圖，demo 效果最好 |
| 4 | 測試結果解釋器 | 把測試欄位、pin、site 與模型判斷轉成工程師可讀的原因說明 | 工作量最大，仰賴規則引擎或模型判斷，建議放最後 |

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

1. 測試趨勢預警（簡報明確提到，可直接延伸現有資料）
2. 批次/晶圓品質摘要（型別已定義，實作量相對小）
3. Wafer map 熱區圖（demo 效果最好）
4. 測試結果解釋器（工作量最大，留到最後）
