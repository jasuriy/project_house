import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prostagram",
  description: "Share your projects: demo video, stack, code and setup in one page.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
