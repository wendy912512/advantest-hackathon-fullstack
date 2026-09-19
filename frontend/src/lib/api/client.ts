import axios from "axios";

// 統一的 Axios instance；只需設定 NEXT_PUBLIC_API_BASE_URL，
// 各功能 API（lib/api/*.ts）不需個別調整連線位址。
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api",
  timeout: 10_000,
  headers: {
    "Content-Type": "application/json",
  },
});
