import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/presentation/components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OCLYX",
  description: "OCLYX Frontend Application",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

// Applies the persisted theme to <html> before first paint to avoid a
// light->dark flash (FOUC). Reads the same localStorage key Zustand persists
// (`theme-storage`). Keep in sync with infrastructure/stores/themeStore.ts.
const themeInitScript = `
(function(){try{var s=localStorage.getItem('theme-storage');if(s&&JSON.parse(s).state.theme==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
