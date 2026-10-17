import type { NextConfig } from "next";

import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    // Serve public images directly across the Vercel Services gateway.
    // This avoids depending on /_next/image for the logo and mascots.
    unoptimized: true,
  },
};

export default nextConfig;
