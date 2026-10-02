import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old category pages, kept working after the categories were merged
  async redirects() {
    return [
      { source: "/category/dress-shirts", destination: "/category/apparel", permanent: true },
      { source: "/category/t-shirts", destination: "/category/apparel", permanent: true },
      { source: "/category/signage", destination: "/category/stickers", permanent: true },
      { source: "/category/retractable-banners", destination: "/category/trade-show", permanent: true },
      { source: "/product/table-covers-:color(black|grey)", destination: "/product/table-covers", permanent: true },
      { source: "/design/table-covers-:color(black|grey)", destination: "/design/table-covers", permanent: true },
    ];
  },
};

export default nextConfig;
