"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Users,
  Wrench,
} from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { getStoreId } from "@/lib/store";
import { toast } from "sonner";

function fmtCLP(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

type PanelData = {
  staff: { professional_id: string; name: string; appointments_count_90d: number; revenue_cents_completed_90d: number }[];
  services_by_revenue: { service_id: string; name: string; completed_count: number; revenue_cents: number }[];
  repeat_clients: { client_id: string; name: string; visits: number }[];
  alerts: {
    ending_soon: { appointment_id: string; client_name: string; service_name: string; professional_name: string; end_time: string; ticket_id: string | null }[];
    overdue_close_30_60m: { appointment_id: string; client_name: string; service_name: string; professional_name: string; end_time: string; ticket_id: string | null }[];
    overdue_close_60m_plus: { appointment_id: string; client_name: string; service_name: string; professional_name: string; end_time: string; ticket_id: string | null }[];
  };
  active_sessions: {
    appointment_id: string;
    client_name: string;
    service_name: string;
    professional_name: string;
    start_time: string;
    end_time: string;
    ticket_id: string | null;
    list_price_cents: number;
    allow_price_override: boolean;
    currency: string;
  }[];
};

export default function SchedulingPanelPage() {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [closeAppt, setCloseAppt] = useState<PanelData["active_sessions"][0] | null>(null);
  const [priceInput, setPriceInput] = useState("");

  useEffect(() => setStoreId(getStoreId()), []);

  const { data: panel, isLoading, refetch, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["scheduling-panel", storeId],
    queryFn: () => api.get<PanelData>("/scheduling/panel").then((r) => r.data),
    enabled: !!storeId,
    staleTime: 35_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const closeMutation = useMutation({
    mutationFn: async ({ id, charged }: { id: string; charged: number }) => {
      await api.patch(`/scheduling/appointments/${id}`, {
        status: "completed",
        charged_price_cents: charged,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-panel"] });
      qc.invalidateQueries({ queryKey: ["scheduling-appointments"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
      toast.success("Atención cerrada; precio registrado y ficha archivada en Operaciones.");
      setCloseAppt(null);
    },
    onError: () => toast.error("No se pudo cerrar la cita"),
  });

  useEffect(() => {
    if (closeAppt) {
      setPriceInput(String(closeAppt.list_price_cents || 0));
    }
  }, [closeAppt]);

  const alertCount = useMemo(() => {
    if (!panel?.alerts) return 0;
    return (
      panel.alerts.ending_soon.length +
      panel.alerts.overdue_close_30_60m.length +
      panel.alerts.overdue_close_60m_plus.length
    );
  }, [panel?.alerts]);

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl text-on-surface">Panel de atención</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            Resumen por trabajador, servicios que más ingresan, clientes recurrentes y alertas cuando falta cerrar una ficha. Al iniciar la hora de la cita se
            abre una ficha en <strong>Operaciones</strong>; al completar la cita podés confirmar o ajustar el monto cobrado (lista vs. precio real en sala).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Actualizar
          </button>
          <Link
            href="/kanban"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md"
          >
            <LayoutGrid className="h-4 w-4" /> Operaciones
          </Link>
        </div>
      </div>

      {!storeId && <p className="text-sm text-amber-700">Selecciona una tienda para ver el panel.</p>}

      {isLoading && !!storeId && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}

      {panel && (
        <>
          {alertCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-900/40 dark:bg-amber-950/30"
            >
              <p className="flex items-center gap-2 text-sm font-bold text-amber-950 dark:text-amber-100">
                <Bell className="h-4 w-4" /> Alertas de cierre de atención ({alertCount})
              </p>
              <ul className="space-y-2 text-sm text-amber-950/90 dark:text-amber-50/90">
                {panel.alerts.ending_soon.map((a) => (
                  <li key={a.appointment_id} className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-xs font-semibold dark:bg-amber-800/60">Termina en ≤15 min</span>
                    {a.client_name} · {a.service_name} · {a.professional_name}
                    {a.ticket_id && (
                      <Link href="/kanban" className="text-xs font-semibold text-amber-800 underline dark:text-amber-200">
                        Ver ficha
                      </Link>
                    )}
                  </li>
                ))}
                {panel.alerts.overdue_close_30_60m.map((a) => (
                  <li key={a.appointment_id} className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-orange-200/90 px-2 py-0.5 text-xs font-semibold text-orange-950">
                      Sin cerrar (30–60 min tras fin)
                    </span>
                    {a.client_name} · {a.service_name}
                    {a.ticket_id && (
                      <Link href="/kanban" className="text-xs font-semibold underline">
                        Operaciones
                      </Link>
                    )}
                  </li>
                ))}
                {panel.alerts.overdue_close_60m_plus.map((a) => (
                  <li key={a.appointment_id} className="flex flex-wrap items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900">
                      Sin cerrar (&gt;60 min tras fin)
                    </span>
                    {a.client_name} · {a.service_name}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          <div className="mb-4 text-xs text-slate-400">
            Última actualización: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString("es-CL") : "—"}
          </div>

          <div className="mb-8 grid gap-4 lg:grid-cols-2">
            <motion.div className="glass-card p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-on-surface">
                <Wrench className="h-5 w-5 text-primary" /> Citas en curso
              </h2>
              {(panel.active_sessions ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No hay citas confirmadas en este momento.</p>
              ) : (
                <ul className="space-y-3">
                  {(panel.active_sessions ?? []).map((s) => (
                    <li key={s.appointment_id} className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                      <p className="font-semibold text-on-surface">
                        {s.client_name} — {s.service_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {s.professional_name} · {new Date(s.start_time).toLocaleString("es-CL")} → {new Date(s.end_time).toLocaleTimeString("es-CL")}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Lista: {fmtCLP(s.list_price_cents)}
                        {s.allow_price_override ? " · podés ajustar al cerrar" : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {s.ticket_id && (
                          <Link
                            href="/kanban"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            Ficha operaciones <ChevronRight className="h-3 w-3" />
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => setCloseAppt(s)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Cerrar y cobrar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>

            <motion.div className="glass-card p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-on-surface">
                <Users className="h-5 w-5 text-primary" /> Clientes recurrentes (90 días)
              </h2>
              {(panel.repeat_clients ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">Aún no hay clientes con 2+ visitas en el período.</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                  {(panel.repeat_clients ?? []).map((c) => (
                    <li key={c.client_id} className="flex justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                      <Link href={`/clients`} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                      <span className="text-slate-500">{c.visits} visitas</span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </div>

          <div className="mb-8 grid gap-4 lg:grid-cols-2">
            <motion.div className="glass-card p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
              <h2 className="mb-3 text-lg font-bold text-on-surface">Por trabajador (90 días)</h2>
              <p className="mb-3 text-xs text-slate-500">Ordenado por ingresos en citas completadas (usa monto cobrado si existe; si no, precio del servicio).</p>
              {/* Cards en mobile, tabla en desktop */}
              <div className="space-y-2 md:hidden">
                {(panel.staff ?? []).map((row) => (
                  <div key={row.professional_id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 dark:border-slate-800">
                    <span className="font-medium text-sm text-on-surface">{row.name}</span>
                    <div className="text-right text-xs text-slate-500">
                      <p>{row.appointments_count_90d} reservas</p>
                      <p className="font-semibold text-on-surface">{fmtCLP(row.revenue_cents_completed_90d)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="pb-2 pr-2">Profesional</th>
                      <th className="pb-2 pr-2">Reservas</th>
                      <th className="pb-2">Ingresos citas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(panel.staff ?? []).map((row) => (
                      <tr key={row.professional_id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-2 font-medium">{row.name}</td>
                        <td className="py-2 pr-2">{row.appointments_count_90d}</td>
                        <td className="py-2">{fmtCLP(row.revenue_cents_completed_90d)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            <motion.div className="glass-card p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <h2 className="mb-3 text-lg font-bold text-on-surface">Servicios / atenciones (más vendidos)</h2>
              <p className="mb-3 text-xs text-slate-500">Solo citas completadas. Vinculá cada servicio a un producto en la API o futura UI de servicios.</p>
              <div className="space-y-2 md:hidden">
                {(panel.services_by_revenue ?? []).map((row) => (
                  <div key={row.service_id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 dark:border-slate-800">
                    <span className="font-medium text-sm text-on-surface">{row.name}</span>
                    <div className="text-right text-xs text-slate-500">
                      <p>{row.completed_count} atenciones</p>
                      <p className="font-semibold text-on-surface">{fmtCLP(row.revenue_cents)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="pb-2 pr-2">Servicio</th>
                      <th className="pb-2 pr-2">Cant.</th>
                      <th className="pb-2">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(panel.services_by_revenue ?? []).map((row) => (
                      <tr key={row.service_id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-2 font-medium">{row.name}</td>
                        <td className="py-2 pr-2">{row.completed_count}</td>
                        <td className="py-2">{fmtCLP(row.revenue_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        </>
      )}

      {closeAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl sm:p-6 dark:bg-slate-900 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <h3 className="text-lg font-bold text-on-surface">Cerrar atención</h3>
            <p className="mt-2 text-sm text-slate-600">
              {closeAppt.client_name} — {closeAppt.service_name}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Precio lista del servicio: {fmtCLP(closeAppt.list_price_cents)}. Confirmá el monto cobrado en sala (peluquería, ajustes, etc.).
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-600">Monto cobrado (CLP)</label>
            <input
              type="number"
              min={0}
              className="input-field mt-1"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setCloseAppt(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={closeMutation.isPending}
                onClick={() => {
                  const n = Math.max(0, Math.floor(Number(priceInput) || 0));
                  closeMutation.mutate({ id: closeAppt.appointment_id, charged: n });
                }}
              >
                {closeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar cierre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
