"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { usePublicAuth } from "@/contexts/PublicAuthContext";

const GoogleButton = dynamic(
  () => import("@/components/ui/GoogleButton").then((m) => m.GoogleButton),
  { ssr: false }
);

export default function RegistroPage() {
  const { googleLogin } = usePublicAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogle = async (accessToken: string) => {
    setLoading(true);
    try {
      await googleLogin(accessToken);
      toast.success("¡Bienvenida a RevoTake!");
      router.push("/explorar");
    } catch {
      toast.error("Error al continuar con Google");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Crear cuenta en RevoTake</h1>
        <p className="text-sm text-gray-500 mb-8">Usa tu cuenta de Google para registrarte</p>
        <GoogleButton onSuccess={handleGoogle} loading={loading} label="Registrarse con Google" />
        <p className="text-xs text-gray-400 mt-6">
          Al continuar aceptas nuestros{" "}
          <span className="text-violet-600">términos de uso</span>
        </p>
      </div>
    </div>
  );
}
