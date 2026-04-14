import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/home/TopNav";

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
        <TopNav />
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </body>
    </html>
  );
}
