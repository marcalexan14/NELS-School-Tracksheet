import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default 1MB is too small for scanned documents attached to a student.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
