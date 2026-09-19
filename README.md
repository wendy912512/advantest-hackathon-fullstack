# Advantest 黑客松 — ACS RTDI 全端系統

本專案將 SmarTest／OneAPI 的即時測試資料，轉為異常監控、趨勢分析、晶圓分布圖與溫度預測的網頁平台。

## 系統架構

```text
SmarTest 執行測試
  → ACS Nexus 收集事件
  → OneAPI 即時事件回呼
  → backend：資料組裝、分析與 FastAPI
  → frontend：Next.js 即時監控儀表板
```

網站的 [about 頁面](frontend/src/app/about/page.tsx) 說明事件流程與名詞對照。

## 專案結構

```text
backend/
├── app/main.py              # FastAPI 路由與 WebSocket 即時串流
├── app/state.py             # OneAPI 回呼與網頁 API 共用的即時狀態
├── app/oneapi_bridge.py     # 接入官方 sample.py 的 OneAPI 轉接層
├── app/csv_import.py        # 題目 RawResult CSV 匯入器
└── data/                    # 本機 CSV；已忽略，不會進 Git

frontend/
├── .env                     # 本機前端 API 位址，已忽略
├── package.json
└── src/
```

## 本機啟動

### 前端

在 `frontend\.env` 建立：

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080/api
```

接著執行：

```cmd
cd frontend
npm install
npm run dev
```

瀏覽器開啟 <http://localhost:3000>。

### 後端

另開終端機執行：

```cmd
cd backend
py -m venv .venv
.venv\Scripts\activate.bat
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8080
```

健康檢查：<http://127.0.0.1:8080/health>。

### 題目 CSV 資料

本機展示可將題目 CSV 放到 `backend\data\`。此資料夾已加入 Git 忽略規則，CSV 不會被提交或推送。

### 本機：使用 CSV 備援資料

在啟動後端的同一個 `cmd` 視窗，先設定：

```cmd
set RTDI_USE_CSV_FALLBACK=true
py -m uvicorn app.main:app --reload --port 8080
```

後端會在啟動時讀取 `backend\data\` 中的一份 CSV，將資料載入記憶體後供網頁顯示。此設定只在目前的終端機視窗有效；關閉視窗或重開終端機後需要重新設定。

### ACS VM：使用 OneAPI 即時事件

**不要設定** `RTDI_USE_CSV_FALLBACK`。即使 `backend\data\` 仍有 CSV，後端也完全不會讀取它，而是等待 OneAPI callback 送入測試事件，再提供給網頁。

官方 RawResult CSV 每顆 Device 有數千個測項；本機備援載入時，儀表板預設保留 24 個有效數值測項，避免瀏覽器回傳過大。完整 CSV 可保留在 `backend\data\` 供後續分析或模型使用。

## ACS debugger：OneAPI 串接測試

本段只測試 **OneAPI callback → FastAPI → 網頁 API**；不需要將 CSV、`backend\data\`、`.venv` 或 `node_modules` 放進 VM。

在 debugger VM 建立 `/home/debugger/project/rtid-backend/`，放入下列檔案：

```text
rtid-backend/
├── app/                     # 整個 backend/app 資料夾
└── requirements.txt
```

啟動 FastAPI：

```bash
cd /home/debugger/project/rtid-backend
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8080
```

先確認 `curl http://127.0.0.1:8080/health` 回傳 `{"status":"ok"}`。ACS 模式不要設定 `RTDI_USE_CSV_FALLBACK`。

接著在官方 OneAPI `sample.py` 加入轉接器。官方 sample 已經有 `toSite`，只需增加：

```python
# sample.py 的 import 區塊
sys.path.insert(0, "/home/debugger/project/rtid-backend")
from app.oneapi_bridge import OneApiHttpBridge

# SampleMonitor.__init__()
self.rtdi = OneApiHttpBridge()
```

在下列既有 callback 函式的最後一行，各加入一行：

```python
# consumeLotStart(self, data)
self.rtdi.on_lot_start(data)

# consumeWaferStart(self, data)
self.rtdi.on_wafer_start(data)

# consumeParametricTest(self, data)
self.rtdi.on_parametric(data, toSite)

# consumeMultiParametric(self, data)
self.rtdi.on_multi_parametric(data, toSite)

# consumeTestEnd(self, data)
self.rtdi.on_test_end(data, toSite)
```

`oneapi_bridge.py` 使用背景佇列將事件依序送至本機 FastAPI，不會因網頁服務暫時無法回應而中斷測試 callback。FastAPI 與 `sample.py` 必須在同一台 debugger VM 上執行；若改成不同主機，才設定 `RTDI_API_BASE_URL` 為 FastAPI 的實際位址。

## 目前整合狀態

- 前端已透過 `frontend/src/lib/api/` 呼叫 FastAPI 的 dashboard、site、lot、wafer、trend、temperature 與失敗說明 API。
- 後端目前以記憶體保存即時事件；服務重啟後資料會清空，因此競賽展示階段不需要自行建立資料庫。
- 實際部署時，將由 `backend/app/oneapi_bridge.py` 從官方 `sample.py` 的回呼函式寫入共享狀態。

## 待完成項目

- 以實際 OneAPI／py-app.log 確認 CP／FT 事件順序與欄位。
- 將 OneAPI 轉接層接入官方 Docker 與 Edge Server。
- 接入團隊的異常偵測與溫度預測模型。

## 注意事項

- OneAPI 應用需在 ACS Gemini／Edge Server 環境執行。
- 不要將帳號、密碼、私鑰或測試環境網址寫入程式碼或 Git。
