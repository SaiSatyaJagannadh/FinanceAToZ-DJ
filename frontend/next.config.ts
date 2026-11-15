import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true
  },
  // Export pages as dashboard/index.html so the S3 website endpoint serves direct visits to /dashboard/
  // (incl. the post-login redirect); with false, CloudFront fell back to the landing page.
  trailingSlash: true,
};

export default nextConfig;
