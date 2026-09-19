# Backend

這個目錄包含 ACS RTDI / ONEAPI 後端的第一個可驗證切片：現有 FastAPI/ONEAPI bridge、事件共用資料模型、異常規則引擎、CSV 離線驗證與告警 API。現階段仍不在本機假造 ONEAPI SDK；真正的 `consumeData(self, tc, data)` adapter 應在 ACS Edge Server 內呼叫這套純 Python 核心。

## 先跑離線驗證

第一次使用先建立環境並安裝依賴：

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
```

在專案根目錄執行：

```bash
python3 -m unittest discover -s backend/tests -t backend
python3 backend/run_validation.py --data-dir "/Users/linyunhsuan/Desktop/碩士班/梅竹黑客松/training/Data"
```

啟動本機 API：

```bash
backend/.venv/bin/uvicorn app.main:app --app-dir backend --reload --port 8000
```

`run_validation.py` 會逐片讀取 25 片訓練 wafer，確認至少抓到題目標註的 W1 site unbalance、W3/W9 low yield、W14/W18 mean trend、W23/W25 stdev trend。正常 wafer 仍會列出規則可能發出的補充告警，這些需要在實際 demo 前依誤報率再調整。

## 模組分工

- `app/models.py`：ONEAPI 與 CSV 共用的量測、告警、摘要資料結構。
- `app/csv_adapter.py`：離線訓練資料轉成量測事件；未來即時事件改接 `event_parser.py`。
- `app/anomaly_engine.py`：OOS、低良率、site 不平衡、平均值趨勢、標準差趨勢。
- `app/state.py`：callback 與 API/WebSocket worker 共用的 thread-safe wafer 狀態，並把已組裝的 device/test 結果送進異常引擎。
- `app/alert_manager.py`：告警去重，並保留 `ActionManager.set_message(testerId, message)` 的單一出口。
- `run_validation.py`：先用訓練 CSV 驗證規則是否抓到官方標註。

- `app/main.py`：既有 Dashboard API，加上 `GET /api/alerts` 結構化告警端點。
- `app/event_parser.py`：`consumeData(self, tc, data)` 的事件分派入口；只在 ACS 環境確認 getter 後接入正式 SampleMonitor。
- `app/worker.py`：背景事件 worker，讓 ONEAPI callback 只 enqueue，不阻塞測試程式。

## 接 ONEAPI 時的順序

ONEAPI 的 `consumeData()` 只做事件類型判斷、欄位轉換與 enqueue；背景 worker 再呼叫 `RuntimeState`、`AnomalyEngine`、`AlertManager`。目前 `event_parser.py` 已先把 `LOTSTART`、`WAFERSTART`、`DATA_TYP_MEASURED_PARAMETRIC`、`DATA_TYP_MEASURED_MULTI_PARAM`、`TESTEND`、`WAFEREND` 對齊到 bridge；`WAFEREND` 會保存一份 wafer summary，正式報告欄位仍需在 ACS 現場確認事件後補強。

請勿將 ACS Gemini、Edge 或 ONEAPI 的帳號、Token、密鑰與內部連線資訊提交到 Git。
