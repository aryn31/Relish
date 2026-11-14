/** @type {import('next').NextConfig} */
export default {
  output: "standalone", // small self-contained server for Docker
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};
