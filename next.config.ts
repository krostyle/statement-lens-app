import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@prisma/client', '@prisma/adapter-pg', 'xlsx'],
  devIndicators: false,
};

export default nextConfig;
