"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { login } from "@/lib/auth";
import api from "@/lib/api";
import { setStoreId } from "@/lib/store";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useGoogleLogin } from "@react-oauth/google";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Bienvenido a RevoTake");
      await redirectAfterLogin();
    } catch {
      toast.error("Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const res = await api.post("/auth/google", { credential: tokenResponse.access_token });
        localStorage.setItem("revotake_token", res.data.access_token);
        localStorage.setItem("revotake_user", JSON.stringify(res.data.user));
        toast.success("Bienvenido a RevoTake");
        await redirectAfterLogin();
      } catch {
        toast.error("Error al iniciar sesión con Google");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => toast.error("Error al iniciar sesión con Google"),
  });

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 p-4 dark:bg-slate-950">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative w-full max-w-md"
      >
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          {/* Brand */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
              <MaterialIcon name="deployed_code" className="text-4xl" filled />
            </div>
            <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">RevoTake</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Gestión empresarial inteligente</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                  placeholder="tu@email.com"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>Ingresar</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs text-slate-400">o continúa con</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continuar con Google</span>
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-600">
          RevoTake &copy; {new Date().getFullYear()} · Todos los derechos reservados
        </p>
      </motion.div>
    </div>
  );
}
