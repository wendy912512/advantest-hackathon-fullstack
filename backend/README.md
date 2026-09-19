# Backend

FastAPI 服務，實作 ACS RTDI / ONEAPI 資料串接。事件從 `oneapi_bridge.py`（真實 OneAPI SampleMonitor 呼叫，或本地開發用的 `/api/internal/*` 端點）進來，`state.py` 的 `RuntimeState` 整理成 Dashboard/Site/Lot/趨勢用的彙總資料，`main.py` 用 FastAPI 對外提供 `frontend/src/lib/api/*.ts` 呼叫的端點。

## 執行

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000
```

前端 `next.config.ts` 已經把 `/api/*` rewrite 到 `http://127.0.0.1:8000/api/*`（可用 `BACKEND_ORIGIN` 環境變數改），所以本機開發不需要另外處理 CORS。

## 本機 CSV Mock

本機啟動時會優先載入 `training/Data/A12345_W01_RawResult.csv` 到 `A12345_W25_RawResult.csv`，並統一提供 Dashboard、Site、Wafer Map 與 Fail Table，避免各畫面使用不同 mock 資料。每份 CSV 會對應成 `W01` 到 `W25`。

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
- `python scripts/build_thermal_fixture.py <RawResult.csv>` 產生前端 mock 備援用的 `frontend/src/lib/api/thermalFixture.json`（真實 W01 資料 + 後端預測結果）。

### ⚠️ 目前的預測模型只是 baseline，請換成正式模型

`predict_sensor()` 是 leave-one-device-out 的 ridge regression：預測 sensorK 只用排在 sensorK **之前**的欄位（較早的 IDDQ 等測項與前面的 sensor）當 feature，不會用到 sensorK 自己或之後的欄位（避免 data leakage）。但它是拿**同一片 wafer** 其他 device 的 sensorK 實測值當訓練資料——真實流程中 sensorK 還沒測，這些值根本拿不到。repo 裡只有 A12345_W01 一片資料，所以先用它當替身，正式模型必須改用 25 片訓練 wafer 訓練。用真實 W01 資料實測，sensor4 的判定為：預測成功 14 / 誤報 23 / 漏報 27 / 正常吻合 16（Warning 區間 ±0.1 是暫定值），準確度還有很大的改進空間。

其他需要與工程師確認的假設：
- 單位：CSV 沒有單位欄，暫定 °C。
- 上限：CSV 的 `High Limit` / `Low Limit` 兩列是反的（sensor 欄位 High=0、Low=35），`csv_import.py` 統一成 low ≤ high，實際範圍 0~35，上限 35。
- Warning 區間（上限 − 0.1）是暫定值。

舊的 `GET /api/temperature/predict`（site 層級、回傳空值）已不再被前端使用。

## Sites 頁 Fail 異常資料表

`GET /api/lots/{lot}/wafers/{wafer}/fails`：只回傳 Fail 資料，一列 = 一顆 fail device 的一個超標事件（PID、X、Y、High/Low Limit、實際數值、SBin/HBin、事件編號如 `220_Main.Suite1#CP`、事件涵義）。CSV 匯入時會檢查全部約 3000 個測項有沒有超出上下限（真實 W01：23 個事件、34 筆、12 顆 fail device），`events` 是給前端下拉選單用的事件清單。

- **Bin 名稱**：Bin 1 確認代表「通過」；其他 bin 目前沒有更細的失敗原因，因此 UI 統一顯示「測試失敗」，不直接呈現 `bin2`、`bin3` 等內部編號。拿到正式 bin 定義後再補上細分類（`app/bin_labels.py`、`frontend/src/lib/binLabels.ts`）。
- **事件涵義**：只有名稱本身有明確依據的才寫——`sensorN`（官方題目點名的溫度 sensor）與 `IDDQ_flow` 底下的測項；其餘約 3000 個 suite 沒有任何說明，涵義欄不顯示（`app/events.py`）。

請勿將 ACS Gemini、Edge 或 ONEAPI 的帳號、Token、密鑰與內部連線資訊提交到 Git。
