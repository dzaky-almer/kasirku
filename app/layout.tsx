import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/sidebar";
import Providers from "./providers"; 
import DemoExpiredPopup, { DemoTimerBanner } from "@/DemoExpiredPopup";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TokoKu | Sistem Kasir Digital",
  description: "TokoKu | Sistem Kasir Digital",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers> {/* ← TAMBAHKAN */}
          <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <DemoTimerBanner />
              {children}
            </div>
            <DemoExpiredPopup />
          </div>
        </Providers> {/* ← TAMBAHKAN */}
      </body>
    </html>
  );
}
