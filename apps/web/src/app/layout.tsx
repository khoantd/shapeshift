import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster, TooltipProvider } from "@shapeshift/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shapeshift — an input that becomes what you mean",
  description:
    "One text box that morphs into the right UI as you type: events, checklists, timers, colors, bill splits and more. Join the waitlist or try the live demo.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  ),
  openGraph: {
    title: "Shapeshift",
    description: "An input that becomes what you mean.",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Shapeshift", description: "An input that becomes what you mean." },
};

export const viewport: Viewport = { themeColor: "#fafaf9", colorScheme: "light", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
