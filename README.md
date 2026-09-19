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

後端啟動後，匯入一份資料到即時儀表板：

```cmd
curl -X POST "http://127.0.0.1:8080/api/internal/import-csv?path=C:\advantest-hackathon-fullstack\backend\data\A12345_W01_RawResult.csv&reset=true&measurement_limit=24"
```

官方 RawResult CSV 每顆 Device 有數千個測項；即時 API 預設載入 24 個有效數值測項，避免瀏覽器回傳過大。完整 CSV 保留在 `backend\data\`，供後續分析或模型使用。到 ACS 正式串接 OneAPI callback 時，不需要匯入 CSV。

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
