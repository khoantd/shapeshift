import type { Metadata, Viewport } from "next";
import { getLocale } from "next-intl/server";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meanbox — an input that becomes what you mean",
  description:
    "One text box that morphs into the right UI as you type: events, checklists, timers, colors, bill splits and more. Join the waitlist or open gadgets.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
  ),
  openGraph: {
    title: "Meanbox",
    description: "An input that becomes what you mean.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Meanbox",
    description: "An input that becomes what you mean.",
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf9",
  colorScheme: "light",
  viewportFit: "cover",
};

/** Document shell — Next.js requires `<html>` / `<body>` in the root layout. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-background font-sans text-foreground"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
