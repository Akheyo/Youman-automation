import type { Metadata } from 'next';
import Dashboard from './Dashboard';

export const metadata: Metadata = {
  title: 'A&B Vertrieb — Dashboard',
  // Internal tool — keep it out of search engines.
  robots: { index: false, follow: false },
};

export default function VertriebPage() {
  return <Dashboard />;
}
