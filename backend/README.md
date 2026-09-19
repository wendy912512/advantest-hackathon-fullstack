# Backend

FastAPI 服務，實作 ACS RTDI / ONEAPI 資料串接。事件從 `oneapi_bridge.py`（真實 OneAPI SampleMonitor 呼叫，或本地開發用的 `/api/internal/*` 端點）進來，`state.py` 的 `RuntimeState` 整理成 Dashboard/Site/Lot/趨勢用的彙總資料，`main.py` 用 FastAPI 對外提供 `frontend/src/lib/api/*.ts` 呼叫的端點。

## 執行

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000
```

前端 `next.config.ts` 已經把 `/api/*` rewrite 到 `http://127.0.0.1:8000/api/*`（可用 `BACKEND_ORIGIN` 環境變數改），所以本機開發不需要另外處理 CORS。

## 目前沒有真實資料

`backend/data/` 目前只有 `.gitkeep`，還沒有載入任何真實 CSV/STDF。所有端點在沒有資料時都回傳空結果（`/api/lots` → `[]`、`/api/sites` → `[]` 等）。可以用 `/api/internal/import-csv` 手動匯入一份本地 CSV 測試；真正串接時應該由 `oneapi_bridge.py` 的 callback 對接 OneAPI 事件。前端 `src/lib/api/*.ts` 目前會在後端回傳空結果時自動退回 mock 資料（見 `withFallback.ts`），demo 時畫面仍然有內容。

## ⚠️ 給資料分析夥伴：`/api/temperature/predict` 目前刻意回傳空

```python
def temperature_snapshot(self) -> dict[str, Any]:
    """A neutral transport contract until the ML team supplies predictions.

    Do not derive temperatures from unrelated parametric values here.  The
    model worker will record real predictions and tester notifications.
    """
    return {"generatedAt": now_iso(), "predictions": [], "notifications": []}
```

這不是漏寫，是刻意留白。前端在場景二初期曾經用「IDDQ 漏電流量測值 → 線性推算一個溫度」的簡化公式做架構雛形，後來確認**這個方向完全錯了**：

- 官方題目要預測的是 6 個具體的 sensor 測項結果（`sensor1#CP` ~ `sensor6#IO3`），不是憑空推算一個溫度數字。
- 執行協議是 ONEAPI 的 **Action/command 通道**（`ActionManager.set_wait()` / `ActionManager.get()`），不是 REST API，回傳格式是一段格式化字串（例如 `"prediction(k):(1:34.06)(2:34.04)..."`），不是 JSON。
- 訓練規則有因果順序限制：預測 sensorK 只能用欄位索引小於 sensorK 的資料當 feature，不能用它自己或之後的欄位（避免 data leakage）。sensor 欄位索引：sensor1=40、sensor2=541、sensor3=1042、sensor4=1543、sensor5=2044、sensor6=2545。

詳細背景見 `frontend/docs/feature-roadmap.md` 與 Notion「🛠️ 後端建立指引」第 0 節。這裡的 `temperature_snapshot()` 保持回傳空值，是為了不讓一個方向錯誤的假資料流程被誤當成正確的架構繼續延伸下去——等真正的 6-sensor 模型與 ONEAPI Action 通道邏輯確定後，把這個方法換成真正的推論結果即可，回傳的 dict 形狀（`predictions`/`notifications`）不需要變動，`frontend/src/lib/api/types.ts` 的 `TemperaturePrediction`/`MachineNotification` 型別已經對齊。

請勿將 ACS Gemini、Edge 或 ONEAPI 的帳號、Token、密鑰與內部連線資訊提交到 Git。
