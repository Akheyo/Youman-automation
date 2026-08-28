import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'

const routes: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/leistungen', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/referenzen', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/ueber-mich', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/kontakt', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/impressum', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/datenschutz', priority: 0.2, changeFrequency: 'yearly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return routes.map((route) => ({
    url: route.path === '/' ? site.url : `${site.url}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
