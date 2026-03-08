import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://linguosovereign.local"),
  title: {
    default: "LinguoSovereign | AI IELTS Studio",
    template: "%s | LinguoSovereign",
  },
  description:
    "LinguoSovereign 是面向 IELTS 备考的 AI 学习平台，提供阅读、听力、写作与口语的模考、评估与复盘体验。",
  applicationName: "LinguoSovereign",
  keywords: [
    "IELTS",
    "AI IELTS",
    "language learning",
    "writing feedback",
    "speaking practice",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
