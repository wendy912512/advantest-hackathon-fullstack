import axios from "axios";

// 統一的 Axios instance；只需設定 NEXT_PUBLIC_API_BASE_URL，
// 各功能 API（lib/api/*.ts）不需個別調整連線位址。
export const apiClient = axios.create({
  // Local development talks directly to FastAPI. This avoids a stale/hung
  // Next rewrite proxy returning the CSV fallback when the backend is healthy.
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api",
  timeout: 10_000,
  headers: {
    "Content-Type": "application/json",
  },
});
