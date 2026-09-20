import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Local development reads the repository-root .env so the same-origin /api proxy can find the
// Express backend. Values that are already set — for example the ones Docker Compose injects —
// always win, so container behaviour is unchanged.
loadEnv({ path: resolve(__dirname, "../.env"), override: false, quiet: true });

const nextConfig: NextConfig = {
  output: "standalone"
};

export default nextConfig;
