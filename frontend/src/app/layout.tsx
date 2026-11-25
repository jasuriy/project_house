import type { Metadata } from "next";
import { Golos_Text, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Golos Text draws Latin and Cyrillic, so Uzbek and Russian text use the same face (D29).
const golos = Golos_Text({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-golos" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "Prostagram",
  description: "Share your projects: demo video, stack, code and setup in one page.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${golos.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
