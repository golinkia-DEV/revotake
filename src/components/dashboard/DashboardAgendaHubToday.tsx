"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Briefcase, Clock, Link2, UserCircle, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import api, { API_URL } from "@/lib/api";
import { getStoreId } from "@/lib/store";
import { toast } from "sonner";

interface HubAppointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  professional_name: string;
  service_name: string;
  client_name: string;
  branch_name: string;
  station_name?: string;
  ticket_id: string | null;
  in_progress: boolean;
  service_price_cents: number;
  allow_price_override: boolean;
}
interface HubMeeting {
  id: string;
  title: string;
  client_id: string | null;
  start_time: string;
  end_time: string;
  meeting_url: string | null;
  ics_token: string;
  confirmation_status: string;
  organizer_name: string;
  organizer_email: string;
}
interface AgendaHub {
  scheduling_included: boolean;
  appointments_in_progress: HubAppointment[];
  meetings_today: HubMeeting[];
}

const statusUi: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Recordatorio pendiente", className: "bg-slate-100 text-slate-700 border-slate-200" },
  awaiting: { label: "Pendiente confirmación", className: "bg-amber-50 text-amber-800 border-amber-200" },
  confirmed: { label: "Confirmada", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  declined: { label: "Rechazada", className: "bg-red-50 text-red-800 border-red-200" },
};

function fmtRange(start: string, end: string) {
  const a = new Date(start);
  const b = new Date(end);
  return `${a.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} – ${b.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
}

function fmtCLP(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

export function DashboardAgendaHubToday() {
  const qc = useQueryClient();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const [closeAppt, setCloseAppt] = useState<HubAppointment | null>(null);
  const [priceInput, setPriceInput] = useState("");

  const { data: hub, isLoading } = useQuery({
    queryKey: ["meetings-agenda-hub", storeId],
    queryFn: () => api.get("/meetings/agenda-hub").then((r) => r.data as AgendaHub),
    enabled: !!storeId,
    refetchInterval: 60_000,
  });

  const closeMutation = useMutation({
    mutationFn: async ({ id, charged }: { id: string; charged: number }) => {
      await api.patch(`/scheduling/appointments/${id}`, { status: "completed", charged_price_cents: charged });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings-agenda-hub"] });
      qc.invalidateQueries({ queryKey: ["scheduling-panel"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
      qc.invalidateQueries({ queryKey: ["pro-appointments"] });
      toast.success("Atención cerrada y precio registrado.");
      setCloseAppt(null);
    },
    onError: () => toast.error("No se pudo cerrar la cita"),
  });

  if (!storeId) return null;

  if (isLoading) {
    return (
      <div className="mb-8 flex justify-center rounded-2xl border border-slate-200 bg-white py-12 dark:border-slate-700 dark:bg-slate-900/40">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!hub) {
    return (
      <p className="mb-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        No se pudo cargar el resumen del día.
      </p>
    );
  }

  return (
    <>
      <section className="mb-8 grid grid-cols-1 gap-8 xl:grid-cols-2">
        {hub.scheduling_included ? (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <Users className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
              </div>
              <h2 className="text-lg font-bold text-on-surface">En atención ahora</h2>
            </div>
            {hub.appointments_in_progress.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/20">
                Nadie en franja activa en este momento.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-1">
                {hub.appointments_in_progress.map((a) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border-2 border-emerald-300/60 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-on-surface">{a.service_name || "Servicio"}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                          <Clock className="h-3 w-3" />
                          {fmtRange(a.start_time, a.end_time)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        En curso
                      </span>
                    </div>
                    <div className="mt-3 space-y-1 border-t border-emerald-200/60 pt-3 text-sm dark:border-emerald-800/50">
                      <p className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <UserCircle className="h-4 w-4 shrink-0 text-primary" />
                        <span>
                          <strong>Profesional:</strong> {a.professional_name || "—"}
                        </span>
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        <strong>Cliente:</strong> {a.client_name || "Sin nombre"}
                      </p>
                      {a.branch_name && (
                        <p className="text-xs text-slate-500">
                          <strong>Sede:</strong> {a.branch_name}
                        </p>
                      )}
                      {a.station_name && (
                        <p className="text-xs text-slate-600">
                          <strong>Puesto:</strong> {a.station_name}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 pt-1">
                        {a.ticket_id && (
                          <Link href="/kanban" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                            Ver ficha Kanban
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setCloseAppt(a);
                            setPriceInput(String(a.service_price_cents || 0));
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Cerrar y cobrar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            Tu rol no incluye la agenda de citas de la tienda; aquí solo ves reuniones del día.
          </div>
        )}

        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
              <Briefcase className="h-4 w-4 text-violet-700 dark:text-violet-300" />
            </div>
            <h2 className="text-lg font-bold text-on-surface">Reuniones hoy</h2>
          </div>
          {hub.meetings_today.length === 0 ? (
            <p className="text-sm text-slate-500">No hay reuniones agendadas para hoy.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-1">
              {hub.meetings_today.map((m) => {
                const su = statusUi[m.confirmation_status] || statusUi.scheduled;
                return (
                  <div key={m.id} className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 dark:border-slate-700">
                    <h3 className="font-semibold text-on-surface">{m.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(m.start_time).toLocaleString("es-CL")} — {m.organizer_name || "Organizador"}
                      {m.organizer_email ? ` · ${m.organizer_email}` : ""}
                    </p>
                    <span className={clsx("mt-2 inline-flex rounded-md border px-2 py-0.5 text-[11px]", su.className)}>{su.label}</span>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.meeting_url && (
                        <a
                          href={m.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <Link2 className="h-3 w-3" /> Entrar
                        </a>
                      )}
                      <a href={`${API_URL}/meetings/ics/${m.ics_token}`} className="text-xs text-slate-500 hover:text-on-surface">
                        .ics
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link href="/calendar" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">
            Ir a agenda completa
          </Link>
        </div>
      </section>

      {closeAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6 dark:bg-slate-900">
            <h3 className="text-lg font-bold text-on-surface">Cerrar atención</h3>
            <p className="mt-2 text-sm text-slate-600">
              {closeAppt.client_name} — {closeAppt.service_name}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Precio lista: {fmtCLP(closeAppt.service_price_cents)}.
              {closeAppt.allow_price_override ? " Podés ajustar el monto cobrado." : ""}
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-600">Monto cobrado (CLP)</label>
            <input
              type="number"
              min={0}
              className="input-field mt-1"
              value={priceInput}
              disabled={!closeAppt.allow_price_override}
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
                onClick={() =>
                  closeMutation.mutate({ id: closeAppt.id, charged: Math.max(0, Math.floor(Number(priceInput) || 0)) })
                }
              >
                {closeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar cierre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
