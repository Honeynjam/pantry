import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pantry/ui", "@pantry/app", "@pantry/backend"],
};

export default nextConfig;
