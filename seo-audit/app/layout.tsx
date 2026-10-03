import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Free SEO Audit for Small Businesses",
  description: "Find out how well your business website is optimized for Google. Instant score and a plain-English list of fixes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
