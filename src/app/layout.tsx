import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/home/TopNav";
import NarrowViewportNotice from "@/components/NarrowViewportNotice";

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
      <body className="app-shell flex h-full flex-col antialiased">
        <NarrowViewportNotice />
        <TopNav />
        <main id="main" className="min-h-0 flex-1 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
