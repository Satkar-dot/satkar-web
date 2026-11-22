import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Satkar - Online Shopping Marketplace",
  description: "Satkar is a multi-vendor e-commerce marketplace where anyone can browse, buy, and sell online. Shop Electronics, Fashion, Home & Kitchen, and Industrial & Tools with Cash on Delivery or Razorpay online payment.",
  openGraph: {
    title: "Satkar - Online Shopping Marketplace",
    description: "Satkar is a multi-vendor e-commerce marketplace where anyone can browse, buy, and sell online. Shop Electronics, Fashion, Home & Kitchen, and Industrial & Tools with Cash on Delivery or Razorpay online payment.",
    type: "website",
    locale: "en_IN",
    siteName: "Satkar Marketplace",
  },
  twitter: {
    card: "summary_large_image",
    title: "Satkar - Online Shopping Marketplace",
    description: "Satkar is a multi-vendor e-commerce marketplace where anyone can browse, buy, and sell online.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
