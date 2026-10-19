import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["700", "800"],
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#005A87",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://bsmartlb.com"),
  title: "B's Mart | Smart Home, Kitchen & Lifestyle Shopping",
  description:
    "Shop kitchenware, appliances, tableware, and home essentials at B's Mart. Fast delivery across Lebanon.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "B's Mart | Smart Home, Kitchen & Lifestyle Shopping",
    description:
      "Shop kitchenware, appliances, tableware, and home essentials at B's Mart. Fast delivery across Lebanon.",
    url: "https://bsmartlb.com",
    siteName: "B's Mart",
    locale: "en_LB",
    type: "website",
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/icon-1024.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${mono.variable}`}
    >
      <body className="min-h-screen flex flex-col bg-background text-foreground selection:bg-smart-teal selection:text-white">
        {children}
      </body>
    </html>
  );
}
