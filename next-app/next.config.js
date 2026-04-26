/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Mapbox GL JS reads `transform` from window which fails during SSR.
  // We isolate it in client components ('use client') so SSR is safe.
};

module.exports = nextConfig;
