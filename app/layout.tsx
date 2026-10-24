import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Pixelify_Sans, Silkscreen } from "next/font/google";
import "./globals.css";
import { TabBar } from "@/components/ui/TabBar";

const pixelifySans = Pixelify_Sans({
  variable: "--font-pixelify-sans",
  subsets: ["latin"],
  display: "swap",
});

const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CityDex",
  description:
    "Turn walking and running around your city into a collecting game.",
  manifest: "/manifest.webmanifest",
  applicationName: "CityDex",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CityDex",
  },
};

export const viewport: Viewport = {
  themeColor: "#5B3A29",
  width: "device-width",
  initialScale: 1,
  // Do not cap maximumScale — users must be able to pinch-zoom (WCAG 1.4.4).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${pixelifySans.variable} ${silkscreen.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-parchment text-wood-dark">
        <main className="flex-1 pb-16">{children}</main>
        <TabBar />
      </body>
    </html>
  );
}
