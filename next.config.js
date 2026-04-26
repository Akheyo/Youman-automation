/**
 * Next.js config.
 *
 * Cesium is loaded as a global script from /cesium/Cesium.js (copied from
 * node_modules/cesium/Build/Cesium via scripts/copy-cesium.js on postinstall).
 * Webpack treats `cesium` as an external on the client so import('cesium')
 * resolves to window.Cesium at runtime.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.ab-solarenergy.de https://ab-solarenergy.de https://www.ab-solarenergy.de;",
          },
        ],
      },
      {
        source: '/cesium/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.externals = config.externals || [];
      // Resolve `import('cesium')` to the global `Cesium` available via the
      // <Script> tag in app/layout.tsx — never bundle the pre-built chunks.
      config.externals.push({ cesium: 'Cesium' });
    } else {
      // Server should never import cesium at all; if it does, fail loudly.
      config.externals = config.externals || [];
      config.externals.push('cesium');
    }
    return config;
  },
};

module.exports = nextConfig;
