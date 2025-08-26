import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Auth from "../src/components/Auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Full Cup",
  description: "Recently added coffee shops and map",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Move suppressHydrationWarning to the body element where the mismatch was reported.
  // The html element is left unchanged; React will now ignore minor attribute mismatches
  // on the body during hydration, preventing the reported warning.
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="border-b">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontWeight: 600 }}>Full Cup</div>
              <nav>
                <Link href="/" style={{ marginRight: 12 }}>Map</Link>
                <Link href="/random" style={{ marginRight: 12 }}>Random</Link>
                <Link href="/new-shops">New Shops</Link>
              </nav>
            </div>

            {/* Auth component shows login/signup forms or the user's email when signed in */}
            <Auth />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
