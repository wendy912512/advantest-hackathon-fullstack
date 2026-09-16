# Advantest Hackathon — RTDI 即時異常監控前端

半導體測試資料即時串流與異常監控 Dashboard 前端。基於 Next.js（App Router）+ TypeScript + Tailwind CSS + shadcn/ui 建置，透過 Axios 呼叫後端 API（目前尚未串接，使用 Mock 資料開發）。

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
│   ├── sites/[id]/           # 單一 Site 詳細頁
│   ├── _components/          # 首頁專屬元件
│   └── layout.tsx
├── components/
│   ├── common/                # 跨頁共用元件（Header 等）
│   ├── features/              # 可重複使用的功能模組
│   └── ui/                    # shadcn/ui 基礎元件
├── hooks/                     # 自訂 Hook（例如輪詢 Dashboard 資料）
├── lib/
│   ├── api/                   # 所有 API 相關程式（client、types、各功能 API）
│   └── utils.ts
└── types/
```

詳細的資料夾規劃與依賴方向請參考團隊的前端開發規範文件。

## 資料層說明

目前後端 ONEAPI 服務尚未就緒，[src/lib/api/mock.ts](src/lib/api/mock.ts) 會產生模擬的測試事件資料（Site 1–4，其中 Site 2 刻意模擬 imbalance 異常）。

[src/lib/api/dashboard.ts](src/lib/api/dashboard.ts)、[src/lib/api/sites.ts](src/lib/api/sites.ts) 是實際頁面呼叫的介面；後端串接完成後，只需把這兩個檔案內部改成呼叫 `apiClient`（見 [src/lib/api/client.ts](src/lib/api/client.ts)），其餘元件與頁面不需更動。

## 常用套件

| 類型 | 套件 |
| --- | --- |
| 樣式 | Tailwind CSS |
| Icon | Tabler Icons |
| UI 元件 | shadcn/ui |
| HTTP Client | Axios |

## 部署

可部署到 [Vercel](https://vercel.com) 或其他支援 Next.js 的平台，細節請參考 [Next.js 部署文件](https://nextjs.org/docs/app/building-your-application/deploying)。
