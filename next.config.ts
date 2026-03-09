import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'mongodb', 'axios', 'bcryptjs',
    '@sparticuz/chromium', 'puppeteer-core', 'puppeteer', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth',
  ],
};

export default nextConfig;
