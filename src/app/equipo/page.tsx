"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Shield, Users, CheckCircle2 } from "lucide-react";
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
  { key: "ver_base_clientes", label: "Ver todas las clientas de la tienda", group: "Clientes" },
  { key: "ver_clientes_propios", label: "Ver sus clientes (citados con él/ella)", group: "Clientes" },
  { key: "ver_historial_cliente", label: "Ver historial de clienta (servicios y montos)", group: "Clientes" },
  { key: "gestionar_notas_cliente", label: "Crear notas internas en ficha de clienta", group: "Clientes" },
  { key: "ver_agenda_propia", label: "Ver su agenda (Mi agenda)", group: "Agenda" },
  { key: "ver_reportes_comisiones", label: "Ver producción / comisiones", group: "Reportes" },
] as const;

function Badge({ children, color }: { children: React.ReactNode; color: "emerald" | "amber" | "rose" | "blue" | "slate" | "purple" }) {
  const c = {
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  }[color];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}

function getInitials(name: string, email: string): string {
  const src = name || email;
  const parts = src.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function hashColor(s: string): string {
  const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-cyan-500"];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

export default function EquipoPage() {
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["auth-me", storeId],
    queryFn: () => api.get("/auth/me").then((r) => r.data),
    enabled: !!storeId,
  });

  const canManage =
    me?.store_context?.member_role_normalized === "store_admin" ||
    me?.store_context?.member_role_normalized === "branch_admin" ||
    me?.store_context?.member_role === "admin";

  const { data, isLoading, error } = useQuery({
    queryKey: ["store-members", storeId],
    queryFn: () => api.get<{ items: MemberRow[] }>(`/stores/${storeId}/members`).then((r) => r.data),
    enabled: !!storeId && !!canManage,
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

  if (!canManage) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shield className="mb-4 h-14 w-14 text-slate-300 dark:text-slate-600" />
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Acceso restringido</p>
          <p className="mt-1 text-sm text-slate-500">
            Solo el <strong>gerente de la tienda</strong> puede ajustar permisos del equipo.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all"
          >
            Volver al inicio
          </Link>
        </div>
      </AppLayout>
    );
  }

  function setPermList(member: MemberRow, key: string, enabled: boolean) {
    const base = new Set(member.permissions);
    if (enabled) base.add(key);
    else base.delete(key);
    if (key === "ver_base_clientes" && enabled) {
      base.add("ver_clientes_propios");
    }
    patch.mutate({ userId: member.user_id, permissions: [...base].sort() });
  }

  function resetMember(member: MemberRow) {
    patch.mutate({ userId: member.user_id, permissions: null });
  }

  const members = data?.items.filter((m) => ["operator", "worker"].includes(m.role)) ?? [];

  // Agrupar permisos por sección
  const groups = Array.from(new Set(OP_TOGGLE.map((o) => o.group)));

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Equipo y permisos</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Ajustá el acceso de cada operador sin afectar al resto. Restablecer vuelve a los permisos por defecto del rol.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800">
          <Shield className="h-4 w-4 text-blue-600" />
          <span className="font-medium text-slate-700 dark:text-slate-200">Gestión de accesos</span>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando equipo…
        </div>
      )}
      {error && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30">
          No se pudo cargar el listado.
        </p>
      )}

      {data && members.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-20 text-center dark:border-slate-700">
          <Users className="mb-4 h-14 w-14 text-slate-300 dark:text-slate-600" />
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Invita a tu equipo</p>
          <p className="mt-1 text-sm text-slate-500">
            Aún no hay operadores o trabajadores en esta tienda.
          </p>
          <Link
            href="/scheduling/profesionales"
            className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all"
          >
            Agregar profesional
          </Link>
        </div>
      )}

      {data && members.length > 0 && (
        <div className="space-y-5">
          {members.map((m) => (
            <div
              key={m.user_id}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              {/* Member header */}
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${hashColor(m.email)}`}
                >
                  {getInitials(m.name, m.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{m.name || m.email}</p>
                  <p className="text-xs text-slate-500">{m.email}</p>
                </div>
                <Badge color={m.role === "worker" ? "slate" : "blue"}>
                  {m.role === "worker" ? "Trabajador" : "Operador"}
                </Badge>
                {m.permissions_override !== null && (
                  <Badge color="amber">Permisos personalizados</Badge>
                )}
              </div>

              {/* Permissions by group */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {groups.map((groupName) => {
                  const groupPerms = OP_TOGGLE.filter((o) => o.group === groupName);
                  return (
                    <div key={groupName} className="px-5 py-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{groupName}</p>
                      <ul className="space-y-2.5">
                        {groupPerms.map(({ key, label }) => {
                          const checked = m.permissions.includes(key);
                          return (
                            <li key={key}>
                              <label className="flex cursor-pointer items-center gap-3">
                                {/* Custom checkbox */}
                                <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                                  <input
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={checked}
                                    disabled={patch.isPending}
                                    onChange={(e) => setPermList(m, key, e.target.checked)}
                                  />
                                  <div className={`h-5 w-5 rounded-md border-2 transition-colors ${checked ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"}`} />
                                  {checked && <CheckCircle2 className="absolute h-3.5 w-3.5 text-white" />}
                                </div>
                                <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
                <button
                  type="button"
                  disabled={patch.isPending}
                  onClick={() => resetMember(m)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50 transition-all"
                >
                  Restablecer por defecto
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
