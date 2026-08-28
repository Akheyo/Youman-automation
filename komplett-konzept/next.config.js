/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone wird nur fuer den Docker-Betrieb gebraucht. Auf Vercel stoert es.
  output: process.env.VERCEL ? undefined : 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Server Actions sind in Next 14 stabil; groessere Payloads fuer Log-Ansichten erlauben.
    serverActions: { bodySizeLimit: '2mb' },
  },
}

module.exports = nextConfig
