import type { NextConfig } from "next";
import fs from "fs";

const { version: APP_VERSION } = JSON.parse(fs.readFileSync("./package.json", "utf-8")) as { version: string };

const nextConfig: NextConfig = {
  reactCompiler: false,
  output: process.env.VERCEL ? undefined : "standalone",

  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
};

export default nextConfig;
