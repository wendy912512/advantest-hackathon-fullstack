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
└── requirements.txt

frontend/
├── package.json             # Next.js 前端套件設定
├── .env.local.example       # 前端 API 位址範例
└── src/
    ├── app/                 # 儀表板與各功能頁面
    ├── components/          # 共用介面元件
    ├── hooks/               # 前端資料輪詢
    └── lib/api/             # 前端 API 呼叫與型別
```

## 本機啟動

### 前端

在 `frontend/` 建立 `.env.local`：

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080/api
```

接著執行：

```powershell
cd frontend
npm install
npm run dev
```

瀏覽器開啟 <http://localhost:3000>。

### 後端

另開終端機執行：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

健康檢查：<http://127.0.0.1:8080/health>。

## 目前整合狀態

- 前端已透過 `frontend/src/lib/api/` 呼叫 FastAPI 的 dashboard、site、lot、wafer、trend、temperature 與失敗說明 API。
- 後端目前以記憶體保存即時事件；服務重啟後資料會清空，因此競賽展示階段不需要自行建立資料庫。
- `frontend/src/lib/api/mock.ts` 仍保留給前端獨立開發使用，不會刪除。
- 實際部署時，將由 `backend/app/oneapi_bridge.py` 從官方 `sample.py` 的回呼函式寫入共享狀態。

## 待完成項目

- 以實際 OneAPI／py-app.log 確認 CP／FT 事件順序與欄位。
- 將 OneAPI 轉接層接入官方 Docker 與 Edge Server。
- 接入團隊的異常偵測與溫度預測模型。

## 注意事項

- OneAPI 應用需在 ACS Gemini／Edge Server 環境執行。
- 不要將帳號、密碼、私鑰或測試環境網址寫入程式碼或 Git。
