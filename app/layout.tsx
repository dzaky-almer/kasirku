import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/sidebar";
import Providers from "./providers";
import DemoExpiredPopup, { DemoTimerBanner } from "@/DemoExpiredPopup";

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
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body suppressHydrationWarning className="min-h-full">
        <Providers>
          <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <DemoTimerBanner />
              {children}
            </div>
            <DemoExpiredPopup />
          </div>
        </Providers>
      </body>
    </html>
  );
}
