import type { Metadata } from "next";
import "./globals.css";
import StreakBadge from "@/components/StreakBadge";
import PendingAnalysesPill from "@/components/PendingAnalysesPill";

export const metadata: Metadata = {
  title: "SQL Coach",
  description: "Interactive SQL practice for coding interviews",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="flex h-full flex-col bg-zinc-950 text-zinc-200 antialiased">
        <nav className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
          <a href="/" className="text-sm font-bold tracking-tight text-zinc-100">
            SQL Coach
          </a>
          <div className="flex items-center gap-3">
            <PendingAnalysesPill />
            <StreakBadge />
          </div>
        </nav>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </body>
    </html>
  );
}
