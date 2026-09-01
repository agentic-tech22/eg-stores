import type { Metadata } from "next";
import { Suspense } from "react";
import { Outfit, Work_Sans, Inter, Poppins, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { ProgressBar } from "@/components/atoms/progress-bar/ProgressBar";
import { toasterOptions } from "@/lib/toast";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "EG Stores", template: "%s · EG Stores" },
  description: "EG Stores: point of sale, inventory, staff and storefront for the whole shop, in one place.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon.svg" }],
  },
  openGraph: {
    type: "website",
    siteName: "EG Stores",
    locale: "en_US",
    images: [{ url: "/assets/images/cover.png", width: 1200, height: 630, alt: "EG Stores" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/assets/images/cover.png"],
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
      className={`${outfit.variable} ${workSans.variable} ${inter.variable} ${poppins.variable} ${playfair.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Suspense fallback={null}>
          <ProgressBar />
        </Suspense>
        {children}
        <Toaster position="top-center" toastOptions={toasterOptions} />
      </body>
    </html>
  );
}
