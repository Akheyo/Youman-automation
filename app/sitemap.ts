import type { MetadataRoute } from 'next';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://app.youman-automation.com').replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ['', '/pricing', '/login', '/signup', '/impressum', '/datenschutz', '/agb', '/widerruf'];
  return routes.map((path) => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path === '/pricing' ? 0.8 : 0.5,
  }));
}
