import type { MetadataRoute } from 'next';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://app.youman-automation.com').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep the logged-in app area and APIs out of the index.
        disallow: ['/felix', '/dashboard', '/sales', '/leads', '/follow-ups', '/verlaeufe', '/einstellungen', '/api/', '/auth/', '/passwort-neu'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
