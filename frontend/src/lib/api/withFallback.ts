// 目前後端（backend/app）已經是可以真的跑起來的 FastAPI 服務，路徑也跟這裡的
// apiClient 呼叫一一對應，但 backend/data 還沒有載入任何真實 CSV（只有一個
// .gitkeep），所以多數端點回傳的是空陣列/空物件（例如 /api/lots → []、
// /api/temperature/predict → {predictions:[],notifications:[]}）。
//
// 在後端真的接上 ONEAPI 或匯入真實資料之前，這裡統一用「先打真的 API，
// 拿不到東西（連線失敗或回傳空）就退回 mock」的方式，確保介面 demo 時
// 一定有內容可以看，同時已經是走真實資料流程、之後資料一到就會自動切換。
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
