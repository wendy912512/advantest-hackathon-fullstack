// 所有頁面都先呼叫 FastAPI；只有連線失敗，或呼叫端明確判定資料不存在時，
// 才使用各 API module 提供的 fallback。不同 API 的「空結果」語意不同，
// 因此由各 API module 自己傳入 isEmpty 規則。
export async function fetchWithFallback<T>(
  fetchReal: () => Promise<T>,
  fallbackFactory: () => T,
  isEmpty: (data: T) => boolean = (data) => data == null || (Array.isArray(data) && data.length === 0),
): Promise<T> {
  try {
    const data = await fetchReal();
    return isEmpty(data) ? fallbackFactory() : data;
  } catch {
    return fallbackFactory();
  }
}
