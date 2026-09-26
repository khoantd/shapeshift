import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { WaitlistLanding } from "@/components/waitlist/WaitlistLanding";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shapeshift — join the waitlist",
  description:
    "An input that becomes what you mean. Join the waitlist for early access to Shapeshift.",
  openGraph: {
    title: "Shapeshift — join the waitlist",
    description: "An input that becomes what you mean.",
    type: "website",
  },
};

export default function Home() {
  return (
    <ConvexClientProvider>
      <WaitlistLanding />
    </ConvexClientProvider>
  );
}
