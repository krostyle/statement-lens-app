import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@prisma/client', '@prisma/adapter-pg'],
  devIndicators: false,
};

export default nextConfig;
