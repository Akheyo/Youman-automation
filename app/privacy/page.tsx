import { redirect } from 'next/navigation';

// Datenschutz now lives at /datenschutz. Keep /privacy working for old links.
export default function PrivacyRedirect() {
  redirect('/datenschutz');
}
