/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nrw/shared'],
  output: 'standalone',
};

module.exports = nextConfig;
