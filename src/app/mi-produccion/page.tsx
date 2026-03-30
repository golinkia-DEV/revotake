"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { getStoreId } from "@/lib/store";
import Link from "next/link";

type Production = {
  from_date: string;
  to_date: string;
  revenue_cents_completed: number;
  commission_cents_estimated: number;
  product_commission_percent_config: number | null;
  note: string;
  by_service: {
    service_id: string;
    service_name: string;
    completed_count: number;
    revenue_cents: number;
    commission_cents: number;
  }[];
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

export default function MiProduccionPage() {
  const storeId = typeof window !== "undefined" ? getStoreId() : null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-my-production", storeId],
    queryFn: () => api.get<Production>("/scheduling/staff/my-production").then((r) => r.data),
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
        <h1 className="mb-2 flex items-center gap-2 text-3xl font-extrabold tracking-tight text-on-surface">
          <TrendingUp className="h-8 w-8 text-primary" />
          Mi producción
        </h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Estimación según citas <strong>completadas</strong> y el porcentaje de comisión definido por servicio al darte
          de alta. El gerente puede quitar el permiso de reportes de comisiones si corresponde.
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
      {data && !isLoading && !error && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Cobro estimado (servicios)</p>
              <p className="mt-1 text-2xl font-extrabold text-on-surface">{fmtMoney(data.revenue_cents_completed)}</p>
              <p className="mt-1 text-xs text-slate-500">
                Periodo {data.from_date} → {data.to_date}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Tu comisión estimada
              </p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-900 dark:text-emerald-100">
                {fmtMoney(data.commission_cents_estimated)}
              </p>
              {data.product_commission_percent_config != null && (
                <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-300">
                  % configurado sobre productos (único para todos los productos): {data.product_commission_percent_config}%
                  — {data.note}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500">{data.note}</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-900/60">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-bold uppercase text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Servicio</th>
                  <th className="px-4 py-3">Completadas</th>
                  <th className="px-4 py-3">Cobro</th>
                  <th className="px-4 py-3">Comisión est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.by_service.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      No hay citas completadas en el período.
                    </td>
                  </tr>
                ) : (
                  data.by_service.map((row) => (
                    <tr key={row.service_id || row.service_name}>
                      <td className="px-4 py-3 font-medium text-on-surface">{row.service_name}</td>
                      <td className="px-4 py-3 text-slate-600">{row.completed_count}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtMoney(row.revenue_cents)}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-700 dark:text-emerald-400">
                        {fmtMoney(row.commission_cents)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
