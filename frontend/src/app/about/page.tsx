import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// 這一頁是系統架構說明文件，不屬於這次 /reference 介面改版的範圍（reference
// 設計稿沒有對應頁面），所以維持原本的 shadcn/ui 風格，只補一個簡單的返回
// 連結——原本靠 RootLayout 裡全域的 <Header/> 才能導覽，但那個 Header 已經
// 改成 Dashboard/Temperature 頁專用（需要即時 site 資料才能渲染 LOT/WAFER
// 資訊），不適合套用在這種靜態文件頁。

const EVENT_FLOW = [
  "LOTSTART",
  "WAFERSTART",
  "TESTSTART",
  "TESTFLOWSTART",
  "TESTSUITESTART",
  "MEASURED_*（測試結果，可能多次）",
  "TESTSUITEEND",
  "TESTFLOWEND",
  "TESTEND",
  "WAFEREND",
  "LOTEND",
];

const PRIORITY_EVENTS = [
  { event: "DATA_TYP_PRODUCTION_WAFERSTART", usage: "建立 wafer session", page: "全部頁面" },
  { event: "DATA_TYP_PRODUCTION_TESTSTART", usage: "記錄測試開始與 site 清單", page: "儀表板" },
  {
    event: "DATA_TYP_MEASURED_PARAMETRIC",
    usage: "主要量測值（含 limit、單位、site 結果）",
    page: "儀表板、趨勢預警",
  },
  {
    event: "DATA_TYP_PRODUCTION_TESTEND",
    usage: "每個 site 的 bin、Part ID、X/Y 座標、測試時間",
    page: "Wafer Map、品質摘要",
  },
  { event: "DATA_TYP_PRODUCTION_WAFEREND", usage: "完成 wafer 統計與報表", page: "品質摘要" },
];

const GLOSSARY = [
  { term: "RTDI", desc: "ACS Real-Time Data Infrastructure，艾德萬的即時測試資料基礎設施" },
  { term: "ACS Nexus", desc: "位於測試現場的資料與控制中心，和 SmartTest 溝通並轉送事件" },
  { term: "ONEAPI", desc: "標準化的資料介面與 Python API，應用程式透過它接收 Nexus 傳來的事件" },
  { term: "SmartTest", desc: "艾德萬的測試程式/測試執行環境，負責實際跑測試流程" },
  { term: "Site", desc: "同一時間平行測試的一個位置" },
  { term: "Soft Bin / Hard Bin", desc: "測試完成後，依結果為 device 分類的結果編號" },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← 返回 Dashboard
      </Link>
      <div>
        <h1 className="text-xl font-semibold">系統架構</h1>
        <p className="text-sm text-muted-foreground">
          本專案為 Advantest 黑客松作品：利用 ONEAPI 提供的即時測試資料，做出能幫助測試工程師判斷問題的
          Dashboard。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">資料流程</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            SmartTest 執行測試 → ACS Nexus 收集事件 → ONEAPI 透過 <code>consumeData()</code>{" "}
            把事件逐一送給後端應用程式 → 後端組裝、判讀 → 前端（本網站）呼叫 API 顯示結果。
          </p>
          <div className="rounded-md border bg-muted/30 p-4 font-mono text-xs leading-relaxed">
            {EVENT_FLOW.map((step, i) => (
              <div key={step}>
                {step}
                {i < EVENT_FLOW.length - 1 && (
                  <div className="pl-2 text-muted-foreground">↓</div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            實際事件順序依 SmartTest 測試程式與設定而變化，上圖為概念流程。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">目前實作對應的優先事件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {PRIORITY_EVENTS.map((e) => (
              <div key={e.event} className="flex flex-col gap-1 border-b pb-3 text-sm last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <code className="text-xs">{e.event}</code>
                  <p className="text-muted-foreground">{e.usage}</p>
                </div>
                <Badge variant="secondary">{e.page}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">目前狀態</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            後端 ONEAPI 服務尚未串接，本網站所有頁面皆使用 Mock 資料層（
            <code>src/lib/api/mock.ts</code>）模擬上述事件產生的結果，資料結構已對齊真實事件欄位，方便後端就緒後直接替換。
          </p>
          <p>
            後端建置規格與 API 對照表請見團隊 Notion「後端建立指引」文件。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">名詞對照</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            {GLOSSARY.map((g) => (
              <div key={g.term} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="w-40 shrink-0 font-medium">{g.term}</dt>
                <dd className="text-muted-foreground">{g.desc}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
