"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import { API_URL } from "@/lib/api";

const GoogleButton = dynamic(
  () => import("@/components/ui/GoogleButton").then((m) => m.GoogleButton),
  { ssr: false }
);

function redirectByRole(globalRole: string, router: ReturnType<typeof useRouter>) {
  if (globalRole === "platform_admin" || globalRole === "platform_operator") {
    router.push("/dashboard");
  } else {
    router.push("/stores");
  }
}

export default function IngresarPage() {
  const { googleLogin } = usePublicAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogle = async (accessToken: string) => {
    setLoading(true);
    try {
      const internalRes = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: accessToken }),
      });

      if (internalRes.ok) {
        const data = await internalRes.json();
        localStorage.setItem("revotake_token", data.access_token);
        localStorage.setItem("revotake_user", JSON.stringify(data.user));
        toast.success("¡Bienvenido!");
        redirectByRole(data.user.global_role || data.user.role || "", router);
        return;
      }

      await googleLogin(accessToken);
      toast.success("¡Bienvenida de vuelta!");
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
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Ingresar a RevoTake</h1>
        <p className="text-sm text-gray-500 mb-8">Usa tu cuenta de Google para continuar</p>
        <GoogleButton onSuccess={handleGoogle} loading={loading} />
      </div>
    </div>
  );
}
