// 所有頁面都先呼叫 FastAPI；只有連線失敗，或呼叫端明確判定資料不存在時，
// 才退回 mock。不同 API 的「空結果」語意不同：例如沒有 Fail、沒有趨勢告警
// 都是有效結果，因此由各 API module 自己傳入 isEmpty 規則。
export async function fetchWithMockFallback<T>(
  fetchReal: () => Promise<T>,
  mockFactory: () => T,
  isEmpty: (data: T) => boolean = (data) => data == null || (Array.isArray(data) && data.length === 0),
): Promise<T> {
  try {
    const data = await fetchReal();
    return isEmpty(data) ? mockFactory() : data;
  } catch {
    return mockFactory();
  }
}
