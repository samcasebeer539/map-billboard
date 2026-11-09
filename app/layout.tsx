import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/components/SettingsProvider";
import { themeInitScript } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Map Billboard",
  description: "A community billboard you pin to a map.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The head script sets the theme class and accent before hydration
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
