import type { Metadata } from "next";
import { PublicAuthProvider } from "@/contexts/PublicAuthContext";
import PublicHeader from "@/components/public/PublicHeader";
import { Providers } from "@/app/providers";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "RevoTake — Encuentra tu tienda de belleza",
  description:
    "Descubre salones de belleza, peluquerías, spas y más cerca de ti. Reserva, sigue tus tiendas favoritas y recibe ofertas exclusivas.",
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <PublicAuthProvider>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <PublicHeader />
          <main className="flex-1">{children}</main>
        </div>
        <Toaster theme="light" position="top-right" richColors />
      </PublicAuthProvider>
    </Providers>
  );
}
