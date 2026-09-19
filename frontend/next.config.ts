import type { NextConfig } from "next";

// 後端 FastAPI 預設跑在獨立的 port（見 backend/README.md，通常是
// http://127.0.0.1:8000），跟 Next.js dev server（:3000）不同源。之前
// apiClient 的 baseURL 預設是相對路徑 "/api"，但這裡完全沒有 rewrite，
// 所以瀏覽器實際打的是 Next.js 自己的 /api（不存在，會 404），從來沒有真的
// 打到後端。用 rewrite 把 /api/* 轉發到後端，瀏覽器端就不需要處理跨網域
// CORS，也不用另外設定 NEXT_PUBLIC_API_BASE_URL。
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
