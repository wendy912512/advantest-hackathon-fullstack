"use client";

import { useFailureExplanations } from "@/hooks/useFailureExplanations";
import { ExplanationCard } from "./_components/ExplanationCard";

export default function ExplainerPage() {
  const { explanations, isLoading } = useFailureExplanations();

  if (isLoading || !explanations) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-muted-foreground">載入測試結果解釋中…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold">測試結果解釋器</h1>
        <p className="text-sm text-muted-foreground">
          把失敗 device 的測試欄位、bin、site 脈絡轉成工程師可讀的原因說明（每 15
          秒重新評估，目前為規則式文字模板，非真正的模型推論——真實原因判斷需要工程師/模型補充，見
          Notion 對齊表）
        </p>
      </div>

      {explanations.length === 0 ? (
        <p className="text-sm text-muted-foreground">目前沒有失敗 device 需要解釋。</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {explanations.map((e) => (
            <ExplanationCard key={e.pid} explanation={e} />
          ))}
        </div>
      )}
    </div>
  );
}
