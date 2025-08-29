import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Auth from "../src/components/Auth";
import AchievementNotifier from "../src/components/AchievementNotifier";
import AchievementNavBadge from "../src/components/AchievementNavBadge";

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
        <header className="border-b bg-[--cottage-secondary] border-[--cottage-neutral-dark]/20">
          <div className="flex justify-between items-center p-3">
            <div className="flex items-center gap-4">
              <div className="font-semibold text-[--cottage-primary] text-xl">☕ Full Cup</div>
              <nav className="flex gap-4">
                <Link href="/" className="px-3 py-1 rounded-lg hover:bg-[--cottage-accent]/20 transition-colors">Map</Link>
                <Link href="/random" className="px-3 py-1 rounded-lg hover:bg-[--cottage-accent]/20 transition-colors">Random</Link>
                <Link href="/new-shops" className="px-3 py-1 rounded-lg hover:bg-[--cottage-accent]/20 transition-colors">New Shops</Link>
              </nav>
            </div>
 
            {/* Auth component shows login/signup forms or the user's email when signed in */}
            <div className="flex items-center gap-3">
              <AchievementNavBadge />
              <Auth />
            </div>
          </div>
        </header>

        {/* Global achievement notifier (toasts) */}
        <AchievementNotifier />

        {children}
      </body>
    </html>
  );
}
