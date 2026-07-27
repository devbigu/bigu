import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { PwaManager } from "@/src/components/pwa/pwa-manager";
import { ThemeProvider } from "@/src/components/theme/theme-provider";
import { QueryProvider } from "@/src/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "BigU",
  applicationName: "BigU",
  description: "Internal social-media growth planning for BigU",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BigU",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var v=localStorage.getItem("bigu-accent-color");if(!/^#[0-9a-fA-F]{6}$/.test(v||""))return;var r=document.documentElement;r.style.setProperty("--primary",v);r.style.setProperty("--sidebar-primary",v);r.style.setProperty("--chart-1",v);r.style.setProperty("--accent-custom",v)}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <QueryProvider>
            {children}
            <PwaManager />
            <Toaster richColors />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}