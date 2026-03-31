"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Shield } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { getStoreId } from "@/lib/store";
import { toast } from "sonner";
import Link from "next/link";

type MemberRow = {
  user_id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  permissions_override: string[] | null;
};

const OP_TOGGLE = [
  { key: "ver_agenda_propia", label: "Ver su agenda (Mi agenda)" },
  { key: "ver_clientes_propios", label: "Ver sus clientes (citados con él/ella)" },
  { key: "ver_reportes_comisiones", label: "Ver producción / comisiones" },
  { key: "ver_historial_cliente", label: "Ver historial de clienta (servicios y montos)" },
  { key: "gestionar_notas_cliente", label: "Crear notas internas en ficha de clienta" },
] as const;

export default function EquipoPage() {
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["auth-me", storeId],
    queryFn: () => api.get("/auth/me").then((r) => r.data),
    enabled: !!storeId,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["store-members", storeId],
    queryFn: () => api.get<{ items: MemberRow[] }>(`/stores/${storeId}/members`).then((r) => r.data),
    enabled: !!storeId && me?.store_context?.member_role === "admin",
  });

  const patch = useMutation({
    mutationFn: ({ userId, permissions }: { userId: string; permissions: string[] | null }) =>
      api.patch(`/stores/${storeId}/members/${userId}/permissions`, { permissions }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-members"] });
      qc.invalidateQueries({ queryKey: ["auth-me"] });
      toast.success("Permisos actualizados");
    },
    onError: () => toast.error("No se pudo actualizar (¿sos gerente de la tienda?)"),
  });

  if (!storeId) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-600">Seleccioná una tienda.</p>
      </AppLayout>
    );
  }

  if (me?.store_context?.member_role !== "admin") {
    return (
      <AppLayout>
        <p className="text-sm text-slate-600">
          Solo el <strong>gerente de la tienda</strong> puede ajustar permisos del equipo.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
          Volver al inicio
        </Link>
      </AppLayout>
    );
  }

  function setPermList(member: MemberRow, key: string, enabled: boolean) {
    const base = new Set(member.permissions);
    if (enabled) base.add(key);
    else base.delete(key);
    patch.mutate({ userId: member.user_id, permissions: [...base].sort() });
  }

  function resetMember(member: MemberRow) {
    patch.mutate({ userId: member.user_id, permissions: null });
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="mb-2 flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl text-on-surface">
          <Shield className="h-8 w-8 text-primary" />
          Equipo y permisos
        </h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Para perfiles <strong>operador</strong> (profesional) podés quitar acceso a &quot;Mis clientes&quot; o &quot;Mi
          producción&quot; sin afectar al resto del equipo. Restablecer vuelve a los permisos por defecto del rol.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando equipo…
        </div>
      )}
      {error && <p className="text-sm text-red-600">No se pudo cargar el listado.</p>}

      {data && (
        <div className="space-y-6">
          {data.items
            .filter((m) => m.role === "operator")
            .map((m) => (
              <div
                key={m.user_id}
                className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-semibold text-on-surface">{m.name || m.email}</p>
                    <p className="text-xs text-slate-500">{m.email}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800">
                    Operador
                  </span>
                </div>
                <ul className="space-y-2">
                  {OP_TOGGLE.map(({ key, label }) => (
                    <li key={key}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={m.permissions.includes(key)}
                          disabled={patch.isPending}
                          onChange={(e) => setPermList(m, key, e.target.checked)}
                        />
                        {label}
                      </label>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={patch.isPending}
                  onClick={() => resetMember(m)}
                  className="btn-ghost mt-3 text-xs"
                >
                  Restablecer permisos por defecto del rol
                </button>
              </div>
            ))}
          {data.items.filter((m) => m.role === "operator").length === 0 && (
            <p className="text-sm text-slate-500">No hay operadores en esta tienda todavía.</p>
          )}
        </div>
      )}
    </AppLayout>
  );
}
