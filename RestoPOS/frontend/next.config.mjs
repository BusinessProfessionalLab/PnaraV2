/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isStaticExport = process.env.CAFE_STATIC_EXPORT === "1";
const apiProxyTarget = process.env.API_PROXY_TARGET || "http://localhost:5088";

const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  ...(isStaticExport
    ? { output: "export", trailingSlash: true }
    : {
        // Keep tracing rooted at this app, not a parent lockfile.
        outputFileTracingRoot: path.join(__dirname),
        async rewrites() {
          return [
            { source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` },
            { source: "/hubs/:path*", destination: `${apiProxyTarget}/hubs/:path*` },
            { source: "/health", destination: `${apiProxyTarget}/health` },
          ];
        },
      }),
};

export default nextConfig;
