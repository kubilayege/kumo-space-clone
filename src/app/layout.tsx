import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kumo Space Clone",
  description: "A virtual office with spatial audio, avatars, and real-time collaboration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
