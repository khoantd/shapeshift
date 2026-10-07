import type { Metadata, Viewport } from "next";
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

/** Pass-through — document shell lives in `[locale]/layout.tsx`. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
