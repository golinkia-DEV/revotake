"use client";

import { useQuery } from "@tanstack/react-query";
import { Mail, Phone, User, Loader2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { getStoreId } from "@/lib/store";
import Link from "next/link";

type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  last_appointment_at: string | null;
};

export default function MiClientesPage() {
  const storeId = typeof window !== "undefined" ? getStoreId() : null;

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

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl text-on-surface">Mis clientes</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Personas con al menos una cita contigo en esta tienda. Si no ves esta sección, el gerente puede haber
          desactivado el permiso <strong>ver clientes propios</strong> en Equipo y permisos.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/mi-agenda" className="font-semibold text-primary hover:underline">
            ← Mi agenda
          </Link>
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando…
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600">
          No tenés permiso o aún no tenés perfil de profesional vinculado en esta tienda.
        </p>
      )}
      {!isLoading && !error && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {(data?.items ?? []).length === 0 ? (
              <li className="p-8 text-center text-sm text-slate-500">Aún no hay clientes con citas registradas.</li>
            ) : (
              data!.items.map((c) => (
                <li key={c.id} className="flex flex-wrap items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-on-surface">{c.name}</p>
                    {c.email && (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                        <Mail className="h-3.5 w-3.5" />
                        {c.email}
                      </p>
                    )}
                    {c.phone && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
                        <Phone className="h-3.5 w-3.5" />
                        {c.phone}
                      </p>
                    )}
                    {c.last_appointment_at && (
                      <p className="mt-2 text-xs text-slate-400">
                        Última cita:{" "}
                        {new Date(c.last_appointment_at).toLocaleString("es-CL", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </AppLayout>
  );
}
