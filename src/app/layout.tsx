import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "A&B Solarenergy · 3D-Solarplaner",
  description:
    "3D-Solarplaner mit MapLibre GL JS, Three.js und Provider-Architektur (Mock / Google Solar / OSM / LoD2).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className={inter.variable}>
      <body className="h-full overflow-hidden font-sans">{children}</body>
    </html>
  );
}
