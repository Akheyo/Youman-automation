/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Server Actions sind in Next 14 stabil; groessere Payloads fuer Log-Ansichten erlauben.
    serverActions: { bodySizeLimit: '2mb' },
  },
}

module.exports = nextConfig
