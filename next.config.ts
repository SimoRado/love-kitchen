import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.100.7"],
};

// Restart worker trigger
export default nextConfig;