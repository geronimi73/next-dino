// debug remnants
// import path from "path";
// import {fileURLToPath} from 'url';
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // See https://webpack.js.org/configuration/resolve/#resolvealias
    // config.resolve.alias = {
    //   ...config.resolve.alias,
    //   "sharp$": false,
    //   "onnxruntime-node$": false,
    // }

    // see https://github.com/vercel/next.js/discussions/41651
    // config.resolve.fallback = {
    //   fs: false,
    //   net: false,
    //   dns: false,
    //   child_process: false,
    //   tls: false,
    // };

    return config;
  },
}

export default nextConfig
