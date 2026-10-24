import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Experimental cacheComponents is disabled: every page in this app is
  // session-aware (cookies) and renders dynamically by design.
  cacheComponents: false,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
