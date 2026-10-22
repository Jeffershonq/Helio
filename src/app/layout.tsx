import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/sora";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Helio", template: "%s · Helio" },
  description: "A team room where you work with three AI agents: Lyra, Carina and Hydra.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F5F1" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0E1A" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
