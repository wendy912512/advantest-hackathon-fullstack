# Backend

FastAPI 服務，實作 ACS RTDI / ONEAPI 資料串接。事件從 `oneapi_bridge.py`（真實 OneAPI SampleMonitor 呼叫，或本地開發用的 `/api/internal/*` 端點）進來，`state.py` 的 `RuntimeState` 整理成 Dashboard/Site/Lot/趨勢用的彙總資料，`main.py` 用 FastAPI 對外提供 `frontend/src/lib/api/*.ts` 呼叫的端點。

## 執行

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000
```

前端 `next.config.ts` 已經把 `/api/*` rewrite 到 `http://127.0.0.1:8000/api/*`（可用 `BACKEND_ORIGIN` 環境變數改），所以本機開發不需要另外處理 CORS。

## 本機 CSV 資料來源

本機啟動時會優先載入 `training/Data/A12345_W01_RawResult.csv` 到 `A12345_W25_RawResult.csv`，並統一提供 Dashboard、Site、Wafer Map 與 Fail Table。使用者選擇 `W01`～`W25` 時，API 會依 wafer 回傳對應 CSV 匯入的資料。

也可以只指定一份檔案：

```powershell
$env:ADVANTEST_MOCK_CSV_PATH = "C:\path\to\A12345_W01_RawResult.csv"
uvicorn app.main:app --port 8000
```

若要停用自動載入：

```powershell
$env:ADVANTEST_MOCK_CSV = "off"
```

正式串接時應該由 `oneapi_bridge.py` 的 callback 對接 OneAPI 事件。若後端沒有資料或未啟動，前端 `src/lib/api/*.ts` 仍會依 `withFallback.ts` 使用示範資料。

## 場景二：per-device sensor 預測（給資料分析夥伴）

流程（不是等 80 個 device 測完才分析）：

```
收到前面已完成的測試資料 → 在「下一個 sensor 測試執行前」預測整片 wafer 每個 device 的下一個 sensor
→ 預測超過門檻立即通知 → 實際 sensor 測試 → 比較預測值與實測值 → 更新通知結果（預測成功 / 誤報 / 漏報）
```

- `GET /api/thermal/wafers/{lot}/{wafer}`（[`app/thermal.py`](app/thermal.py)）：回傳 6 個 sensor 的 meta（上限、階段 verified/next/future）與每個 device 的預測值、實測值、誤差、預測狀態（normal/warning/critical/pending）、判定。即時 wafer 未輪到的 sensor 不預測、未實測的 sensor 不回傳實際值。
- `POST /api/internal/thermal-progress {"completed": n}`：CSV 匯入時所有數值一次到齊，用這個模擬「即時 wafer 已完成幾個 sensor」（預設 3：sensor1~3 已實測、預測 sensor4）。串 ONEAPI 後應由收到的 sensor 量測事件推算。
- `python scripts/build_thermal_fixture.py <RawResult.csv>` 產生前端 CSV-derived fallback 用的 fixture（真實 W01 資料 + 後端預測結果）。

### Thermal 模型驗證報告

用目前 API 實際使用的跨 wafer LightGBM 模型，執行完整 Leave-One-Wafer-Out 驗證：

```bash
python backend/scripts/validate_thermal_model.py
```

報告會輸出到 `backend/reports/thermal_validation.md` 與
`backend/reports/thermal_validation.json`，包含每個 sensor 的 MAE、RMSE、
準確度、預測成功、誤報、漏報、每片 wafer 的交叉驗證結果，以及新 wafer
評估狀態。若有獨立評估資料，可另外執行：

```bash
python backend/scripts/validate_thermal_model.py --eval-dir path/to/eval-csv
```

沒有 `--eval-dir` 時，報告會將 W01～W25 的每一折視為一片未見過的新 wafer；
這是離線的新 wafer 模擬，不會冒充獨立實測結果。

### ⚠️ 目前的預測模型只是 baseline，請換成正式模型

目前 `fit_cross_wafer_predictor()` 是跨 wafer 的 LightGBM：預測 sensorK 只用排在 sensorK **之前**的欄位，加上 IDDQ 對數與 touchdown index 特徵，先以訓練 wafer 做特徵重要度排序，再保留 Top-80；不會用到 sensorK 自己或之後的欄位（避免 data leakage）。查看某一片 wafer 時採 Leave-One-Wafer-Out；預測真正的新 wafer 時則使用 W01～W25 全部訓練資料。模型誤差與預測成功/誤報/漏報請以 `validate_thermal_model.py` 產生的報告為準。

其他需要與工程師確認的假設：
- 單位：CSV 沒有單位欄，暫定 °C。
- 限制值：CSV 的 `High Limit` / `Low Limit` 會依原始欄位保存；例如 `220_Main.Suite1#CP` 是 `High=0.6`、`Low=1.8`。目前不對兩個值重新排序，實際欄位語意需再向資料提供方確認。
- Warning 區間（上限 − 0.1）是暫定值。

舊的 `GET /api/temperature/predict`（site 層級、回傳空值）已不再被前端使用。

## Sites 頁製程趨勢分析

`GET /api/trends?lot={lot}&wafer={wafer}` 會以「Site + 實際測試項目」分組，
不再把不同測試項目混成 `ALL`。每條序列依 Device 的測試時間排序，前 10 個量測值
建立 baseline mean 與 sample standard deviation，並以 mean ± 3σ 計算 UCL/LCL；
少於 18 個量測點時不產生趨勢告警。告警只代表該測項在這片 wafer 內的統計訊號，
不是把不同測項混合後的平均，也不等同於跨 lot 的製程能力分析。

前端 Trend Alert 會讓使用者選擇同一 Site 的測試項目，圖表 X 軸是實際測試順序，
tooltip 會顯示 Device PID；正常測項不顯示趨勢卡片。

## Sites 頁 Fail 異常資料表

`GET /api/lots/{lot}/wafers/{wafer}/fails`：只回傳 Fail 資料，一列 = 一顆 fail device 的一個超標事件（PID、X、Y、High/Low Limit、實際數值、SBin/HBin、事件編號如 `220_Main.Suite1#CP`、事件涵義）。CSV 匯入時會檢查全部約 3000 個測項有沒有超出上下限（真實 W01：23 個事件、34 筆、12 顆 fail device），`events` 是給前端下拉選單用的事件清單。

- **Bin 名稱**：Bin 1 確認代表「通過」；其他 bin 目前沒有更細的失敗原因，因此 UI 統一顯示「測試失敗」，不直接呈現 `bin2`、`bin3` 等內部編號。拿到正式 bin 定義後再補上細分類（`app/bin_labels.py`、`frontend/src/lib/binLabels.ts`）。
- **事件涵義**：只有名稱本身有明確依據的才寫——`sensorN`（官方題目點名的溫度 sensor）與 `IDDQ_flow` 底下的測項；其餘約 3000 個 suite 沒有任何說明，涵義欄不顯示（`app/events.py`）。
這個目錄包含 ACS RTDI / ONEAPI 後端的第一個可驗證切片：現有 FastAPI/ONEAPI bridge、事件共用資料模型、異常規則引擎、CSV 離線驗證與告警 API。現階段仍不在本機假造 ONEAPI SDK；真正的 `consumeData(self, tc, data)` adapter 應在 ACS Edge Server 內呼叫這套純 Python 核心。

## 先跑離線驗證

第一次使用先建立環境並安裝依賴：

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
```

在專案根目錄執行：

```bash
python3 -m unittest discover -s backend/tests -t backend
python3 backend/run_validation.py --data-dir "/Users/linyunhsuan/Desktop/碩士班/梅竹黑客松/training/Data"
```

啟動本機 API：

```bash
backend/.venv/bin/uvicorn app.main:app --app-dir backend --reload --port 8000
```

`run_validation.py` 會逐片讀取 25 片訓練 wafer，確認至少抓到題目標註的 W1 site unbalance、W3/W9 low yield、W14/W18 mean trend、W23/W25 stdev trend。正常 wafer 仍會列出規則可能發出的補充告警，這些需要在實際 demo 前依誤報率再調整。

### 目前異常規則的判斷方式

分析順序以 RawResult 的 device 列順序為準；即時 ONEAPI 串接時，則以
`touchdown_index`（或確認過的事件時間順序）取代 CSV 列號。

1. **Out of Spec**：每一筆量測值立即與該測項原始的 `Low Limit`、`High Limit`
   比較。CSV 的兩個欄位會原樣保留，不在程式中交換或排序。
2. **Low Yield**：以 SBin 判斷通過／失敗；目前 `SBin=6` 是失敗 bin，良率低於
   `0.80` 且至少有 20 筆分類資料時告警。
3. **Site Unbalance**：先比較各 Site 的良率；再對同一測項的 Site 平均值做差異檢查。
   目前至少 5 筆／Site、p-value 門檻 `0.01`、差異至少達 pooled standard
   deviation 的 3 倍時告警。
4. **Mean Trend**：將每顆 device 的測項平均值依順序排列，計算線性斜率與 R²。
   目前至少 8 個點；平均值的正規化斜率至少 `0.00004` 且 R² 至少 `0.05`。
   訓練資料的方向定義是負斜率對應 `MEAN_TREND_UP`、正斜率對應
   `MEAN_TREND_DOWN`，這個方向在正式 ONEAPI 上線前仍須用事件時間確認。
5. **Stdev Trend**：對同一序列計算 rolling standard deviation，再對標準差序列做
   斜率與 R² 檢查；profile 序列目前使用 `profile_stdev_r2=0.20`、
   `profile_stdev_normalized_slope=0.0003`。告警 evidence 同時保留普通線性回歸與
   Theil–Sen robust slope，方便現場追查是否由單一離群值造成。

目前資料驗證已穩定通過 W01、W03、W09、W14、W18、W23，以及所有正常 wafer；
W25 的 `STDEV_TREND_DOWN` 標籤目前仍無法從 CSV 中以不誤報正常 wafer 的通用規則
重現。這不是以 W25 名稱或編號做特例，而是保留為待確認的資料定義問題。

### 完整驗證流程（macOS）

在專案根目錄執行：

```bash
backend/.venv/bin/python -m unittest discover -s backend/tests -t backend
backend/.venv/bin/python backend/run_validation.py \
  --data-dir "/Users/linyunhsuan/Desktop/碩士班/梅竹黑客松/training/Data"
```

第一個指令必須顯示 `OK`。第二個指令會列出 W01～W25 的判定；目前預期是 W01、
W03、W09、W14、W18、W23 顯示對應異常，W25 顯示 `FAIL W25: NORMAL`，這代表
程式尚未取得 W25 的正式判斷依據，不代表測試程式當掉。

若要驗證 API 與前端資料流，另開終端機啟動：

```bash
backend/.venv/bin/uvicorn app.main:app --app-dir backend --port 8000
```

再確認：

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/alerts
curl http://127.0.0.1:8000/api/dashboard/snapshot
```

應分別得到 `{"status":"ok"}`、結構化告警陣列與 Dashboard snapshot。瀏覽器開啟
`http://localhost:8000/api` 可檢查 FastAPI 文件；前端則以 `npm run dev` 啟動後開啟
`http://localhost:3000`，確認告警面板、Site、Wafer 與 Fail Table 使用同一份資料。

## 模組分工

- `app/models.py`：ONEAPI 與 CSV 共用的量測、告警、摘要資料結構。
- `app/csv_adapter.py`：離線訓練資料轉成量測事件；未來即時事件改接 `event_parser.py`。
- `app/anomaly_engine.py`：OOS、低良率、site 不平衡、平均值趨勢、標準差趨勢。
- `app/state.py`：callback 與 API/WebSocket worker 共用的 thread-safe wafer 狀態，並把已組裝的 device/test 結果送進異常引擎。
- `app/alert_manager.py`：告警去重，並保留 `ActionManager.set_message(testerId, message)` 的單一出口。
- `run_validation.py`：先用訓練 CSV 驗證規則是否抓到官方標註。

- `app/main.py`：既有 Dashboard API，加上 `GET /api/alerts` 結構化告警端點。
- `app/event_parser.py`：`consumeData(self, tc, data)` 的事件分派入口；只在 ACS 環境確認 getter 後接入正式 SampleMonitor。
- `app/worker.py`：背景事件 worker，讓 ONEAPI callback 只 enqueue，不阻塞測試程式。

## 接 ONEAPI 時的順序

ONEAPI 的 `consumeData()` 只做事件類型判斷、欄位轉換與 enqueue；背景 worker 再呼叫 `RuntimeState`、`AnomalyEngine`、`AlertManager`。目前 `event_parser.py` 已先把 `LOTSTART`、`WAFERSTART`、`DATA_TYP_MEASURED_PARAMETRIC`、`DATA_TYP_MEASURED_MULTI_PARAM`、`TESTEND`、`WAFEREND` 對齊到 bridge；`WAFEREND` 會保存一份 wafer summary，正式報告欄位仍需在 ACS 現場確認事件後補強。
請勿將 ACS Gemini、Edge 或 ONEAPI 的帳號、Token、密鑰與內部連線資訊提交到 Git。
