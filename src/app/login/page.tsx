"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import api from "@/lib/api";
import { setStoreId } from "@/lib/store";
import { API_URL } from "@/lib/api";

const GoogleButton = dynamic(
  () => import("@/components/ui/GoogleButton").then((m) => m.GoogleButton),
  { ssr: false }
);

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
    } catch { /* sin tiendas */ }
    router.push("/stores");
  }

  const handleGoogle = async (accessToken: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: accessToken }),
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
  };

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
          <GoogleButton onSuccess={handleGoogle} loading={loading} />
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          RevoTake &copy; {new Date().getFullYear()} · Todos los derechos reservados
        </p>
      </motion.div>
    </div>
  );
}
