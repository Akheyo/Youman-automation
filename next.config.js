/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: { instrumentationHook: true },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

// Only wrap with Sentry when a DSN is configured, so local/preview builds stay
// clean until error monitoring is switched on.
let config = baseConfig;
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const { withSentryConfig } = require('@sentry/nextjs');
  config = withSentryConfig(baseConfig, {
    silent: true,
    widenClientFileUpload: true,
    disableLogger: true,
  });
}

module.exports = config;
