# Advantest 黑客松 — ACS RTDI 全端系統

半導體測試資料即時串流與異常監控平台。前端使用 Next.js、TypeScript 與 Tailwind CSS；後端使用 FastAPI，提供儀表板所需的 API 與 WebSocket 即時串流。

## 系統架構

本專案利用 Advantest ONEAPI 提供的即時測試資料（lot/wafer/site/test）：

```
SmarTest 執行測試
  → ACS Nexus 收集事件
  → ONEAPI 透過 consumeData() 逐一送出事件（LOTSTART...WAFERSTART...TESTEND...WAFEREND...LOTEND）
  → OneAPI 轉接層將必要欄位寫入後端共享狀態
  → FastAPI 提供 API 與 WebSocket
  → 前端網頁呼叫 API 顯示結果
```

網站內建 [/about](frontend/src/app/about/page.tsx) 頁面說明完整事件流程與名詞對照。後端建置規格（要支援哪些事件、如何組裝成前端需要的格式、各 API 應回傳的型別）見團隊 Notion「後端建立指引」文件。

## 開始開發

前端啟動方式：

```cmd
cd /d C:\advantest-hackathon-fullstack\frontend
npm install
npm run dev
```

開啟瀏覽器造訪 [http://localhost:3000](http://localhost:3000)。

### 後端

後端位於 `backend/`，請另開終端機執行：

```cmd
cd /d C:\advantest-hackathon-fullstack\backend
py -m venv .venv
.venv\Scripts\activate.bat
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8080
```

前端在 `frontend/` 建立 `.env.local`，填入：

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080/api
```

目前後端以記憶體保存即時事件，服務重啟後資料會清空；競賽即時展示不需要另外建立資料庫。

### 題目 CSV 資料

本機展示可將題目 CSV 複製到 `backend\data\`。此資料夾已加入 Git 忽略規則，CSV 不會被提交或推送；原始檔仍保留在 `C:\Users\feng2\Downloads\training\Data`。

```cmd
cd /d C:\advantest-hackathon-fullstack
mkdir backend\data
copy "C:\Users\feng2\Downloads\training\Data\*.csv" backend\data\
```

後端啟動後，匯入一份資料到即時儀表板：

```cmd
curl -X POST "http://127.0.0.1:8080/api/internal/import-csv?path=C:\advantest-hackathon-fullstack\backend\data\A12345_W01_RawResult.csv&reset=true&measurement_limit=24"
```

官方 RawResult CSV 每顆 Device 有數千個測項；即時 API 預設載入 24 個有效數值測項，避免瀏覽器回傳過大。完整 CSV 會保留在 `backend\data\`，供後續分析或模型使用。到 ACS 正式串接 OneAPI callback 時，不需要匯入 CSV。

## 專案結構

```
backend/
├── app/main.py              # FastAPI 路由與 WebSocket 即時串流
├── app/state.py             # OneAPI 回呼與網頁 API 共用的即時狀態
├── app/oneapi_bridge.py     # 部署時接入官方 sample.py 的 OneAPI 轉接層
└── requirements.txt
frontend/
├── package.json               # Next.js 前端套件設定
├── .env.local.example         # 前端 API 位址範例
└── src/
    ├── app/                   # 儀表板與各功能頁面
    ├── components/            # 共用介面元件
    ├── hooks/                 # 前端資料輪詢
    └── lib/api/               # 前端 API 呼叫與型別
```

詳細的資料夾規劃與依賴方向請參考團隊的前端開發規範文件。

## 資料層說明

FastAPI 的端點格式已建立；OneAPI 實際接入時，將由 `backend/app/oneapi_bridge.py` 從官方 `sample.py` 的回呼函式轉入共享狀態。接入前需以實際 py-app.log 確認事件欄位與 CP／FT 流程。

`frontend/src/lib/api/{dashboard,sites,trends,lots,wafer,explainer,temperature}.ts` 透過 `apiClient` 呼叫 FastAPI；回傳格式以 [frontend/src/lib/api/types.ts](frontend/src/lib/api/types.ts) 為共同規格。`frontend/src/lib/api/mock.ts` 會保留給前端獨立開發使用，不會刪除。

## 常用套件

| 類型 | 套件 |
| --- | --- |
| 樣式 | Tailwind CSS |
| 圖示 | Tabler Icons |
| 介面元件 | shadcn/ui |
| HTTP 用戶端 | Axios |

## 部署

可部署到 [Vercel](https://vercel.com) 或其他支援 Next.js 的平台，細節請參考 [Next.js 部署文件](https://nextjs.org/docs/app/building-your-application/deploying)。
