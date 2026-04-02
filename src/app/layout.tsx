import type { Metadata } from "next";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "RevoTake — Gestión Empresarial con IA",
  description: "Plataforma inteligente para agenda, clientes, stock y operaciones",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`light ${manrope.variable} ${plusJakarta.variable}`}>
      <body className="min-h-screen bg-surface font-sans antialiased">
        <Providers>
          {children}
          <Toaster theme="light" position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
