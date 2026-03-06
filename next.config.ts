import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['mongodb', 'axios', 'bcryptjs', '@sparticuz/chromium', 'puppeteer-core'],
};

export default nextConfig;
