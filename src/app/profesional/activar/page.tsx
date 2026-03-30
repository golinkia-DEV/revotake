"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Lock, User } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

function ActivarProfesionalInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [proName, setProName] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setValid(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/auth/professional-invite/${encodeURIComponent(token)}`);
        if (cancelled) return;
        setValid(!!data.valid);
        setStoreName(data.store_name ?? "");
        setProName(data.professional_name ?? "");
        setEmail(data.email ?? "");
        setName(data.professional_name ?? "");
      } catch {
        if (!cancelled) setValid(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== password2) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/professional-invite/accept", {
        token,
        password,
        name: name.trim() || undefined,
      });
      localStorage.setItem("revotake_token", data.access_token);
      localStorage.setItem("revotake_user", JSON.stringify(data.user));
      toast.success("Cuenta activada. Elegí tu tienda para continuar.");
      router.replace("/stores");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? String((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "")
          : "";
      toast.error(msg || "No se pudo completar la activación");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
            <MaterialIcon name="person_add" className="text-2xl" filled />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Activar tu perfil</h1>
            <p className="text-sm text-slate-500">RevoTake · profesional</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Validando enlace…
          </div>
        ) : !token || !valid ? (
          <p className="text-sm text-slate-600">
            El enlace no es válido o expiró. Pedí a la tienda que te envíe una nueva invitación desde{" "}
            <strong>Crear profesional</strong>.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-600">
              Te invitaron desde <strong>{storeName}</strong>. Correo: <strong>{email}</strong>
            </p>
            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 flex items-center gap-1 font-medium text-slate-700">
                  <User className="h-3.5 w-3.5" /> Nombre en el sistema
                </span>
                <input
                  className="input-field w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={proName}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 flex items-center gap-1 font-medium text-slate-700">
                  <Lock className="h-3.5 w-3.5" /> Contraseña (mín. 8 caracteres)
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="input-field w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 font-medium text-slate-700">Repetir contraseña</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="input-field w-full"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={submitting || password.length < 8}
                className="btn-primary w-full disabled:opacity-50"
              >
                {submitting ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Crear contraseña y entrar"}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function ActivarProfesionalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ActivarProfesionalInner />
    </Suspense>
  );
}
