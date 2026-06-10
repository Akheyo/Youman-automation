import { redirect } from 'next/navigation';

// The landing now lives at "/". Keep /start working for old links/bookmarks.
export default function StartRedirect() {
  redirect('/');
}
