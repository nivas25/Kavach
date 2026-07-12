import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kavach | AI-Powered Legal Contract Analysis",
  description: "Protect yourself from predatory clauses. Kavach uses a multi-agent AI debate system to analyze legal contracts, uncover hidden risks, and provide actionable negotiation strategies.",
  openGraph: {
    title: "Kavach | AI-Powered Legal Contract Analysis",
    description: "Protect yourself from predatory clauses with a multi-agent AI debate system.",
    url: "https://kavach.ai",
    siteName: "Kavach",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kavach | AI-Powered Legal Contract Analysis",
    description: "Protect yourself from predatory clauses with a multi-agent AI debate system.",
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
      className={`h-full antialiased ${jakarta.variable} font-sans`}
    >
      <body className="min-h-full flex flex-col font-sans text-slate-900 bg-white selection:bg-slate-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
