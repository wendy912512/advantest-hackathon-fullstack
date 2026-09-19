# Backend

這個目錄預留給 ACS RTDI / ONEAPI 的後端整合程式。

目前專案中尚未提供可執行的後端服務；現有前端先使用 mock data 顯示量產監控、異常分析與溫度預測介面。後續接上 Edge / ONEAPI 時，建議將事件接收、資料轉換、模型推論與通知機制放在這裡，並由 `frontend/src/lib/api/` 呼叫後端 API。

請勿將 ACS Gemini、Edge 或 ONEAPI 的帳號、Token、密鑰與內部連線資訊提交到 Git。
