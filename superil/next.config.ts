import path from "path";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  // Self-contained server bundle for the Docker image (see Dockerfile); `next start` is used otherwise.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  async headers() {
    const privateHeaders = [
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Cache-Control", value: "no-store" },
    ];
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/admin/:path*", headers: privateHeaders },
      { source: "/api/admin/:path*", headers: privateHeaders },
    ];
  },
};

export default nextConfig;
