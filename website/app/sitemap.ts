import type { MetadataRoute } from 'next'
import { branchen } from '@/lib/branchen'
import { referenzen } from '@/lib/referenzen'
import { site } from '@/lib/site'

type Eintrag = {
  path: string
  priority: number
  changeFrequency: 'weekly' | 'monthly' | 'yearly'
}

/** Statische Seiten. Branchen und Referenzen kommen aus den Datenquellen,
 *  damit eine neue Seite nie vergessen wird. */
const statisch: Eintrag[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/branchen', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/leistungen', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/referenzprojekte', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/ueber-uns', priority: 0.6, changeFrequency: 'yearly' },
  { path: '/faq', priority: 0.75, changeFrequency: 'monthly' },
  { path: '/kontakt', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/impressum', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/datenschutz', priority: 0.2, changeFrequency: 'yearly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  const eintraege: Eintrag[] = [
    ...statisch,
    ...branchen.map((b) => ({
      path: `/branchen/${b.slug}`,
      priority: 0.85,
      changeFrequency: 'monthly' as const,
    })),
    ...referenzen.map((r) => ({
      path: `/referenzprojekte/${r.slug}`,
      priority: 0.7,
      changeFrequency: 'yearly' as const,
    })),
  ]

  return eintraege.map((e) => ({
    url: e.path === '/' ? site.url : `${site.url}${e.path}`,
    lastModified,
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }))
}
