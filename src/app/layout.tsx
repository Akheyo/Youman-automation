import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Youman 3D-Solarplaner",
  description:
    "3D-Solarplaner-Prototyp mit MapLibre GL JS, Three.js und Provider-Architektur (Mock / Google Solar / LoD2).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
