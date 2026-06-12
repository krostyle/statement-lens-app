import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],
  devIndicators: false,
};

export default nextConfig;
