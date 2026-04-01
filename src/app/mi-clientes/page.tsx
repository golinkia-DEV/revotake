"use client";

import { useQuery } from "@tanstack/react-query";
import { Mail, Phone, Loader2, Users, Search, Star } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { getStoreId } from "@/lib/store";
import Link from "next/link";
import { useState } from "react";

type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  last_appointment_at: string | null;
  appointment_count?: number;
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `hace ${d}d`;
  if (h > 0) return `hace ${h}h`;
  if (m > 0) return `hace ${m}m`;
  return "ahora";
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function hashColor(name: string): string {
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500",
    "bg-amber-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function MiClientesPage() {
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-my-clients", storeId],
    queryFn: () => api.get<{ items: Row[] }>("/scheduling/staff/my-clients").then((r) => r.data),
    enabled: !!storeId,
  });

  if (!storeId) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-600">Seleccioná una tienda.</p>
      </AppLayout>
    );
  }

  const allItems = data?.items ?? [];
  const filtered = search.trim()
    ? allItems.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.email?.toLowerCase().includes(search.toLowerCase()) ||
          c.phone?.includes(search)
      )
    : allItems;

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mis Clientes</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Personas con al menos una cita contigo en esta tienda. Si no ves esta sección, el gerente puede haber
            desactivado el permiso <strong>ver clientes propios</strong>.
          </p>
        </div>
        <Link
          href="/mi-agenda"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 transition-all shrink-0"
        >
          ← Mi agenda
        </Link>
      </div>

      {/* Search */}
      {!isLoading && allItems.length > 0 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pl-10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30">
          No tenés permiso o aún no tenés perfil de profesional vinculado en esta tienda.
        </div>
      )}

      {!isLoading && !error && allItems.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-20 text-center dark:border-slate-700">
          <Users className="mb-4 h-14 w-14 text-slate-300 dark:text-slate-600" />
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Aún no tienes clientes asignados</p>
          <p className="mt-1 text-sm text-slate-500">
            Los clientes aparecerán aquí una vez que tengas citas registradas.
          </p>
        </div>
      )}

      {!isLoading && !error && allItems.length > 0 && filtered.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
          No se encontraron clientes con ese criterio.
        </p>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((c) => {
              const isFrecuente = (c.appointment_count ?? 0) > 3;
              return (
                <li key={c.id} className="flex flex-wrap items-start gap-4 p-4 hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-800/30">
                  {/* Avatar */}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${hashColor(c.name)}`}
                  >
                    {getInitials(c.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                      {isFrecuente && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          <Star className="h-3 w-3" />
                          Frecuente
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3">
                      {c.email && (
                        <p className="flex items-center gap-1.5 text-sm text-slate-500">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          {c.email}
                        </p>
                      )}
                      {c.phone && (
                        <p className="flex items-center gap-1.5 text-sm text-slate-500">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {c.phone}
                        </p>
                      )}
                    </div>
                    {c.last_appointment_at && (
                      <p className="mt-1.5 text-xs text-slate-400">
                        Última cita:{" "}
                        <span className="font-medium text-slate-500">
                          {new Date(c.last_appointment_at).toLocaleDateString("es-CL", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}{" "}
                          · {relTime(c.last_appointment_at)}
                        </span>
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </AppLayout>
  );
}
