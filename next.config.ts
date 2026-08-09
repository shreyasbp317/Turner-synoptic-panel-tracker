import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Floor plans can be multi‑MB .jsvg files
  experimental: {
    serverActions: {
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;
