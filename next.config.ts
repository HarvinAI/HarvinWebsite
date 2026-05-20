import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Self-contained build at .next/standalone for the Cloud Run Dockerfile.
  // Vercel/Railway ignore this and bundle natively — safe to leave on.
  output: 'standalone',
  // Pin the workspace root so Next.js doesn't nest the standalone output
  // under a parent lockfile's directory (a stray ~/package-lock.json was
  // making server.js land at .next/standalone/harvinai-next/server.js
  // instead of .next/standalone/server.js).
  outputFileTracingRoot: path.resolve('.'),
  serverExternalPackages: [
    'mongodb', 'axios', 'bcryptjs',
    '@sparticuz/chromium', 'puppeteer-core', 'puppeteer', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth',
  ],
};

export default nextConfig;
