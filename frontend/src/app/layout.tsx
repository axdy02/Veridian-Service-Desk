import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veridian Service Desk",
  description: "A practical workspace for Veridian service requests"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
