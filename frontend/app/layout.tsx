import type { Metadata } from "next";
import "./globals.css";
import LearningShell from "@/components/navigation/LearningShell";

export const metadata: Metadata = {
  title: "SURI | Grade 9-10 Algebra Mastery",
  description:
    "Adaptive mathematics learning application for Philippine Junior High School students",
  icons: {
    icon: "/suri-snake-happy.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* This single shared stylesheet is intentionally defined at the root app layout. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800;900&family=Manrope:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#f7f9fb] text-[#191c1e] min-h-screen font-['Manrope']">
        <LearningShell>{children}</LearningShell>
      </body>
    </html>
  );
}
