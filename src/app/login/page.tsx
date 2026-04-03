"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { useGoogleLogin } from "@react-oauth/google";
import api from "@/lib/api";
import { setStoreId } from "@/lib/store";
import { API_URL } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function redirectAfterLogin() {
    try {
      const { data } = await api.get("/stores/");
      if (data.items?.length) {
        setStoreId(data.items[0].id);
        router.push("/dashboard");
        return;
      }
    } catch {
      /* sin tiendas */
    }
    router.push("/stores");
  }

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: tokenResponse.access_token }),
        });

        if (!res.ok) {
          toast.error("No tienes una cuenta interna en RevoTake");
          return;
        }

        const data = await res.json();
        localStorage.setItem("revotake_token", data.access_token);
        localStorage.setItem("revotake_user", JSON.stringify(data.user));
        toast.success("Bienvenido a RevoTake");
        await redirectAfterLogin();
      } catch {
        toast.error("Error al iniciar sesión con Google");
      } finally {
        setLoading(false);
      }
    },
    onError: () => toast.error("Error al iniciar sesión con Google"),
  });

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative w-full max-w-sm"
      >
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 text-center">
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
            <MaterialIcon name="deployed_code" className="text-4xl" filled />
          </div>
          <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-slate-900">RevoTake</h1>
          <p className="text-sm text-slate-500 mb-8">Gestión empresarial inteligente</p>

          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Continuar con Google</span>
              </>
            )}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          RevoTake &copy; {new Date().getFullYear()} · Todos los derechos reservados
        </p>
      </motion.div>
    </div>
  );
}
