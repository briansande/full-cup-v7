import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure image domains and remote patterns so external images can be allowed later.
  // Add hostnames (e.g. 'images.unsplash.com') to `domains` or use `remotePatterns`
  // for more granular control (protocol, hostname, port, pathname).
  images: {
    domains: [],
    remotePatterns: [],
  },
};

export default nextConfig;
