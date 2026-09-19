# Advantest Hackathon - ACS RTDI Fullstack

Advantest ACS RTDI 黑客松全端專案，目標是將 SmartTest/ONEAPI 即時測試資料轉換成異常監控、趨勢分析、Wafer Map 與溫度預測等功能。

## 系統架構

```text
SmartTest
  -> ACS Nexus
  -> ONEAPI 即時事件
  -> backend（資料組裝、分析與 API）
  -> frontend（監控 Dashboard）
```

## 專案結構

```text
backend/     # 後端服務；目前待接入 OneAPI 與分析引擎
frontend/    # Next.js Dashboard
```

目前前端使用 mock data 開發，模擬 Site 1-4 的測試事件、Site imbalance、趨勢漂移、位移與 Wafer Map edge effect。後端串接完成後，前端各功能 API 可改由 `frontend/src/lib/api/client.ts` 呼叫實際服務，頁面與元件不需要大幅修改。

## 前端開發

```bash
cd frontend
npm install
npm run dev
```

開啟 <http://localhost:3000>。

前端包含：

- 即時異常監控首頁
- Site 詳細分析
- 趨勢與 SPC 圖表
- Lot / Wafer 品質摘要
- Wafer Map
- 測試結果解釋器
- 溫度預測與機台通知頁面

## 後端整合方向

後端需要接收 OneAPI 事件，例如：

```text
LOTSTART -> WAFERSTART -> TESTSTART -> 測試結果 -> TESTEND -> WAFEREND -> LOTEND
```

再將事件整理成前端所需的 Dashboard API，並依黑客松題目實作異常偵測或 IC 溫度預測。

## 注意事項

- OneAPI 應用需要在 ACS Gemini / Edge Server 環境中執行。
- 本機 frontend 可以先使用 mock data 開發，不代表已完成 RTDI 整合。
- 不要將帳號、密碼、私鑰或測試環境網址寫入程式碼或 Git。
