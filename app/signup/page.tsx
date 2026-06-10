import type { Metadata } from 'next';
import AuthForm from '../login/AuthForm';

export const metadata: Metadata = { title: 'Registrieren · Youman Automation' };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
