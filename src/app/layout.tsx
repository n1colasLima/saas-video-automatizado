import type { Metadata } from "next";
import { Fira_Sans, Fira_Code } from "next/font/google";
import { Sidebar } from "@/components/layout/sidebar";
import "./globals.css";

const firaSans = Fira_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-fira-sans",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fira-code",
});

export const metadata: Metadata = {
  title: "Tomada",
  description: "Pipeline autônomo de geração de vídeos com IA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br" className={`${firaSans.variable} ${firaCode.variable}`}>
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-y-auto px-12 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
