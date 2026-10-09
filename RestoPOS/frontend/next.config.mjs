/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Same-origin proxy fallback (used only when NEXT_PUBLIC_API_URL is blank).
const API = process.env.API_PROXY_TARGET || "http://192.168.100.249:5000";

const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Keep tracing rooted at this app, not a parent lockfile.
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API}/api/:path*` },
      { source: "/hubs/:path*", destination: `${API}/hubs/:path*` },
      { source: "/health", destination: `${API}/health` },
    ];
  },
};

export default nextConfig;
