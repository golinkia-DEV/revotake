"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, DollarSign, Percent, Clock } from "lucide-react";
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
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mi Producción</h1>
          {data && (
            <p className="mt-1 text-sm text-slate-500">
              Período {data.from_date} → {data.to_date}
            </p>
          )}
        </div>
        <Link
          href="/mi-agenda"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 transition-all"
        >
          ← Mi agenda
        </Link>
      </div>

      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Estimación según citas <strong>completadas</strong> y el porcentaje de comisión definido por servicio. El gerente puede quitar el permiso de reportes de comisiones si corresponde.
      </p>

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

      {data && !isLoading && !error && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Cobro estimado */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <TrendingUp className="absolute right-4 top-4 h-16 w-16 text-slate-100 dark:text-slate-800" style={{ opacity: 1 }} />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cobro estimado (servicios)</p>
              <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{fmtMoney(data.revenue_cents_completed)}</p>
              <p className="mt-1.5 text-xs text-slate-400">Citas completadas en el período</p>
            </div>

            {/* Comisión estimada */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40">
              <DollarSign className="absolute right-4 top-4 h-16 w-16 text-emerald-100 dark:text-emerald-900" />
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Tu comisión estimada</p>
              <p className="mt-2 text-3xl font-bold text-emerald-900 dark:text-emerald-100">{fmtMoney(data.commission_cents_estimated)}</p>
              {data.product_commission_percent_config != null && (
                <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                  <Percent className="mr-1 inline h-3 w-3" />
                  {data.product_commission_percent_config}% sobre productos
                </p>
              )}
            </div>
          </div>

          {data.note && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              {data.note}
            </p>
          )}

          {/* Services table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h2 className="font-semibold text-slate-900 dark:text-white">Detalle por servicio</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                <tr>
                  <th className="px-5 py-3">Servicio</th>
                  <th className="px-5 py-3">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Completadas
                    </span>
                  </th>
                  <th className="px-5 py-3">Cobro</th>
                  <th className="px-5 py-3">Comisión est.</th>
                </tr>
              </thead>
              <tbody>
                {data.by_service.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-500">
                      Aún no tienes ventas registradas este período.
                    </td>
                  </tr>
                ) : (
                  data.by_service.map((row, idx) => (
                    <tr
                      key={row.service_id || row.service_name}
                      className={`border-t border-slate-100 dark:border-slate-800 ${idx % 2 !== 0 ? "bg-slate-50/50 dark:bg-slate-800/20" : ""}`}
                    >
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{row.service_name}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {row.completed_count}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{fmtMoney(row.revenue_cents)}</td>
                      <td className="px-5 py-3 font-semibold text-emerald-700 dark:text-emerald-400">
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
