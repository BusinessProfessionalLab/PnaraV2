/** @type {import('next').NextConfig} */
const API = process.env.API_PROXY_TARGET || "http://localhost:5088";

const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API}/api/:path*` },
      { source: "/hubs/:path*", destination: `${API}/hubs/:path*` },
      { source: "/health", destination: `${API}/health` },
    ];
  },
};

export default nextConfig;
