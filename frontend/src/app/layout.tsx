import type { Metadata } from "next";
import { Figtree, JetBrains_Mono, Onest } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin", "latin-ext"], variable: "--font-figtree" });
// Figtree has no Cyrillic letters; Onest (similar shapes) draws Russian text.
const onest = Onest({ subsets: ["cyrillic"], variable: "--font-onest" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "Prostagram",
  description: "Share your projects: demo video, stack, code and setup in one page.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${onest.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
