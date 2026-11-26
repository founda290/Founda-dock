import type { Metadata } from "next";
import "./globals.css";
import { StationProviderRoot } from "@/lib/query-provider";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { Shell } from "@/components/Shell";
import { ConfirmDialog, Toasts } from "@/components/ui";

// Fonts: system stack (Geist/Inter fall back gracefully). Self-host via
// next/font/local if you want bundled fonts — Google Fonts is not fetched at build time.

export const metadata: Metadata = {
  title: "Founda Dock — Code. Create. Automate.",
  description: "Remote development control centre for your Android-hosted Station.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-bg text-text">
        <StationProviderRoot>
          <AppSidebar />
          <Shell>
            <AppHeader />
            <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
          </Shell>
          <Toasts />
          <ConfirmDialog />
        </StationProviderRoot>
      </body>
    </html>
  );
}
