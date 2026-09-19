# Advantest Hackathon — RTDI 即時異常監控前端

半導體測試資料即時串流與異常監控 Dashboard 前端。基於 Next.js（App Router）+ TypeScript + Tailwind CSS + shadcn/ui 建置，透過 Axios 呼叫後端 API（目前尚未串接，使用 Mock 資料開發）。

## 系統架構

本專案利用 Advantest ONEAPI 提供的即時測試資料（lot/wafer/site/test）：

```
SmartTest 執行測試
  → ACS Nexus 收集事件
  → ONEAPI 透過 consumeData() 逐一送出事件（LOTSTART...WAFERSTART...TESTEND...WAFEREND...LOTEND）
  → 後端組裝、判讀（尚未串接）
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

目前後端 ONEAPI 服務尚未就緒，[src/lib/api/mock.ts](src/lib/api/mock.ts) 會產生模擬的測試事件資料（Site 1–4，其中 Site 2 刻意模擬 imbalance 異常、Site 3 模擬趨勢漂移、Site 4 模擬位移，wafer map 模擬 edge die effect）。

`src/lib/api/{dashboard,sites,trends,lots,wafer,explainer}.ts` 是各頁面實際呼叫的介面；後端串接完成後，只需把這些檔案內部改成呼叫 `apiClient`（見 [src/lib/api/client.ts](src/lib/api/client.ts)），其餘元件與頁面不需更動。回傳格式請對齊 [src/lib/api/types.ts](src/lib/api/types.ts) 裡的 TypeScript interface。

## 常用套件

| 類型 | 套件 |
| --- | --- |
| 樣式 | Tailwind CSS |
| Icon | Tabler Icons |
| UI 元件 | shadcn/ui |
| HTTP Client | Axios |

## 部署

可部署到 [Vercel](https://vercel.com) 或其他支援 Next.js 的平台，細節請參考 [Next.js 部署文件](https://nextjs.org/docs/app/building-your-application/deploying)。
