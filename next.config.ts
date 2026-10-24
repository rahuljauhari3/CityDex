import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Hide the dev-tools overlay/indicator so it never covers the bottom tab bar
  // (QA #2). It has no effect on production builds.
  devIndicators: false,
  // The /api/stamps + /api/dex handlers run on the Node runtime (Buffer/crypto
  // and the server-only store). Cache Components stays off since it is
  // incompatible with the `runtime` route-segment config.
  turbopack: {
    // Pin the workspace root so Next uses this repo's lockfile, not a stray
    // package-lock.json higher up the filesystem.
    root: fileURLToPath(new URL(".", import.meta.url)),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
