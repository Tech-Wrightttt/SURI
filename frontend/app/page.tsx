import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "SURI | Adaptive Mathematics Learning",
  description: "Learn junior high school math with SURI. Identify learning gaps, study personalized lessons, practice step by step, and track topic mastery.",
};

export default function Home() {
  return <LandingPage />;
}
