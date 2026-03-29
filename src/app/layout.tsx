import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RevoTake — Gestión Empresarial con IA",
  description: "Plataforma inteligente para agenda, clientes, stock y operaciones",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`light ${manrope.variable}`}>
      <body className="min-h-screen bg-surface font-sans antialiased">
        <Providers>
          {children}
          <Toaster theme="light" position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
