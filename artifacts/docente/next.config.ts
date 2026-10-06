import type { NextConfig } from "next";

const config: NextConfig = {
  // The smoke suite builds a second, staging-mode copy of the app next to the production one (see playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  allowedDevOrigins: ["*.replit.dev", "*.replit.app"],
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    }];
  },
};
export default config;