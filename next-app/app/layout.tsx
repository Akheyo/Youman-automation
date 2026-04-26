import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PV-Konfigurator · A&B Solarenergy',
  description:
    'Photovoltaik-Konfigurator: Adresse eingeben, 3D-Haus aus Open-Data, automatische PV-Belegung.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
