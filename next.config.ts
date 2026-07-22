import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle standalone (server.js + node_modules mínimos) para la imagen de
  // Docker de producción — ver frontend/Dockerfile.
  output: "standalone",
};

export default nextConfig;
