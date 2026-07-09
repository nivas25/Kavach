import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kavach | Your AI Legal Shield",
  description: "AI-powered legal document intelligence to analyze contracts and uncover hidden risks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${jakarta.variable} font-sans`}
    >
      <body className="min-h-full flex flex-col font-sans text-slate-900 bg-white selection:bg-slate-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
