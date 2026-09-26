import { ShapeshiftApp } from "@/components/ShapeshiftApp";
import { SiteChrome } from "@/components/SiteChrome";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo — Shapeshift",
  description:
    "Try the morphing input live: events, checklists, timers, colors, bill splits and more.",
};

export default function DemoPage() {
  return (
    <>
      <ShapeshiftApp />
      <SiteChrome />
    </>
  );
}
