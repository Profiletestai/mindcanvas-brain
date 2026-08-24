const path = require("path");

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",

  outputFileTracingRoot: path.join(__dirname, "..", ".."),

  // TypeScript has already been verified separately with `pnpm typecheck`.
  typescript: {
    ignoreBuildErrors: true,
  },

  experimental: {
    webpackMemoryOptimizations: true,
    webpackBuildWorker: false,
  },
};

module.exports = nextConfig;