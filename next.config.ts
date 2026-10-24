import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Cache Components is incompatible with the `runtime` route-segment config,
  // and the /api/stamps + /api/dex handlers must run on the Node runtime for
  // the server-only Anthropic SDK and crypto. Keep the explicit Node runtime
  // and leave Cache Components off. (partialPrefetching requires
  // cacheComponents, so it comes off with it.)
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
