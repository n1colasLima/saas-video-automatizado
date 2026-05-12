import type { Metadata } from "next";
import { Fira_Sans, Fira_Code } from "next/font/google";

import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

const firaSans = Fira_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-fira-sans",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tomada · pipeline de vídeo",
  description: "Pipeline autônomo de geração de vídeos longos e shorts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${firaSans.variable} ${firaCode.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          {children}
        </div>
      </body>
    </html>
  );
}
