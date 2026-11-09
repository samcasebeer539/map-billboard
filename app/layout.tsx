import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Map Billboard",
  description: "A community billboard you pin to a map.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
