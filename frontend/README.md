# Advantest Hackathon — RTDI 即時異常監控前端

半導體測試資料即時串流與異常監控 Dashboard 前端。基於 Next.js（App Router）+ TypeScript + Tailwind CSS + shadcn/ui 建置，透過 Axios 呼叫 FastAPI 後端 API。後端未回傳資料或服務不可用時，前端才使用本機示範資料作為 fallback。

## 系統架構

本專案利用 Advantest ONEAPI 提供的即時測試資料（lot/wafer/site/test）：

```
SmartTest 執行測試
  → ACS Nexus 收集事件
  → ONEAPI 透過 consumeData() 逐一送出事件（LOTSTART...WAFERSTART...TESTEND...WAFEREND...LOTEND）
  → FastAPI 後端組裝、判讀（本機 CSV / internal adapter 已可用）
  → 前端（本網站）呼叫 API 顯示結果
```

網站內建 [/about](src/app/about/page.tsx) 頁面說明完整事件流程與名詞對照。後端建置規格（要支援哪些事件、如何組裝成前端需要的格式、各 API 應回傳的型別）見團隊 Notion「後端建立指引」文件。

## 開始開發

安裝依賴套件：

```bash
npm install
```

啟動開發伺服器：

```bash
npm run dev
```

開啟瀏覽器造訪 [http://localhost:3000](http://localhost:3000)。

## 專案結構

```
src/
├── app/
│   ├── page.tsx              # 儀表板首頁（即時異常監控面板）
│   ├── sites/[id]/           # 單一 Site 詳細頁（imbalance 比較）
│   ├── trends/                # 測試趨勢預警（SPC control chart）
│   ├── lots/                  # 批次/晶圓品質摘要（Bin Pareto）
│   ├── wafer-map/             # Wafer map 熱區圖
│   ├── explainer/             # 測試結果解釋器
│   ├── about/                 # 系統架構說明
│   ├── _components/          # 首頁專屬元件
│   └── layout.tsx
├── components/
│   ├── common/                # 跨頁共用元件（Header 等）
│   ├── features/              # 可重複使用的功能模組
│   └── ui/                    # shadcn/ui 基礎元件
├── hooks/                     # 自訂 Hook（各頁面輪詢資料）
├── lib/
│   ├── api/                   # 所有 API 相關程式（client、types、各功能 API）
│   └── utils.ts
└── types/
```

詳細的資料夾規劃與依賴方向請參考團隊的前端開發規範文件。

## 資料層說明

### 目前資料來源與串接狀態

- 前端的 `src/lib/api/` 已透過 `apiClient` 呼叫 FastAPI 的 dashboard、site、lot、wafer、trend、temperature 與 fail API。
- FastAPI 可從訓練用 RawResult CSV 匯入資料，也提供 `/api/internal/*` adapter endpoint，讓前端與本機測試流程使用相同的 `RuntimeState`。
- `src/lib/api/mock.ts` 不是目前唯一資料來源；只有後端連線失敗或資料不存在時，才作為 fallback。`failFixture.json` 與 `thermalFixture.json` 是從訓練 CSV 產生的示範資料，不代表即時 ONEAPI 資料。
- 真實 SmartTest／ACS Edge Server 的 OneAPI `SampleMonitor` callback 尚未完成部署與端到端驗證。目前 `backend/app/oneapi_bridge.py` 已提供 callback 到共享狀態的轉接函式，但仍需在官方 `sample.py`、ACS 環境中接入，並以實際 `py-app.log` 驗證事件欄位與順序。

`src/lib/api/{dashboard,sites,trends,lots,wafer,explainer}.ts` 是各頁面呼叫後端的介面，實際 HTTP client 位於 [src/lib/api/client.ts](src/lib/api/client.ts)。回傳格式請對齊 [src/lib/api/types.ts](src/lib/api/types.ts) 裡的 TypeScript interface。

## 常用套件

| 類型 | 套件 |
| --- | --- |
| 樣式 | Tailwind CSS |
| Icon | Tabler Icons |
| UI 元件 | shadcn/ui |
| HTTP Client | Axios |

## 部署

可部署到 [Vercel](https://vercel.com) 或其他支援 Next.js 的平台，細節請參考 [Next.js 部署文件](https://nextjs.org/docs/app/building-your-application/deploying)。
