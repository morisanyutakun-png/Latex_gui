import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Route Handler のタイムアウト延長 (PDF生成は時間がかかる)
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
