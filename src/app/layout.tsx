import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { DeckFilters } from "@/components/PlayingCard";
import { PreferenceEffects } from "@/components/PreferenceEffects";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Poker Night: mesa de poker com os amigos",
  description: "Mesa de Texas Hold'em online, em tempo real, para jogar com os teus amigos.",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a0e12",
  // required for env(safe-area-inset-*) to resolve to anything but 0 on iOS —
  // without it the notch/Dynamic Island/home-indicator padding is a no-op
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <head>
        {/* both render on every hand of every room — worth a priority hint
            over waiting for the browser to discover them mid-render */}
        <link rel="preload" as="image" href="/images/card-back.webp" />
        <link rel="preload" as="image" href="/images/table-bg.webp" />
      </head>
      <body className="min-h-full flex flex-col bg-slate-950 text-white">
        <DeckFilters />
        <PreferenceEffects />
        {children}
      </body>
    </html>
  );
}
