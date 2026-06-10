import type { Metadata } from 'next';
import FelixChat from './FelixChat';

export const metadata: Metadata = {
  title: 'Felix — Lead-Scout',
  // Internal tool — keep it out of search engines.
  robots: { index: false, follow: false },
};

export default function FelixPage() {
  return <FelixChat />;
}
