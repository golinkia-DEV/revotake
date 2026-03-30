"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Calendar,
  Plus,
  Clock,
  Link2,
  Users,
  Briefcase,
  Stethoscope,
  LayoutGrid,
  ExternalLink,
  UserCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import api, { API_URL } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import clsx from "clsx";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import Link from "next/link";
import { getStoreId } from "@/lib/store";

interface MeetingItem {
  id: string;
  title: string;
  client_id: string | null;
  start_time: string;
  end_time: string;
  meeting_url: string | null;
  ics_token: string;
  confirmation_status: string;
  reminder_sent_at: string | null;
}

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

interface HubTicket {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  client_id: string | null;
  due_date: string | null;
  assigned_to: string | null;
  assignee_name: string;
  extra_data?: { appointment_id?: string };
}

interface AgendaHub {
  timezone: string;
  now_local_iso: string;
  appointments_in_progress: HubAppointment[];
  appointments_rest_today: HubAppointment[];
  meetings_today: HubMeeting[];
  active_tickets: HubTicket[];
  scheduling_included: boolean;
}

const statusUi: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Recordatorio pendiente", className: "bg-slate-100 text-slate-700 border-slate-200" },
  awaiting: { label: "Pendiente confirmación", className: "bg-amber-50 text-amber-800 border-amber-200" },
  confirmed: { label: "Confirmada", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  declined: { label: "Rechazada", className: "bg-red-50 text-red-800 border-red-200" },
};

const apptStatusLabel: Record<string, string> = {
  pending_payment: "Pago pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No asistió",
};

function fmtCLP(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function fmtRange(start: string, end: string) {
  const a = new Date(start);
  const b = new Date(end);
  return `${a.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} – ${b.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function CalendarPage() {
  const qc = useQueryClient();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const [closeAppt, setCloseAppt] = useState<HubAppointment | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    meeting_url: "",
    client_id: "",
  });

  const { data: hub, isLoading: hubLoading } = useQuery({
    queryKey: ["meetings-agenda-hub", storeId],
    queryFn: () => api.get("/meetings/agenda-hub").then((r) => r.data as AgendaHub),
    enabled: !!storeId,
    refetchInterval: 60_000,
  });

  const { data } = useQuery({ queryKey: ["meetings"], queryFn: () => api.get("/meetings/").then((r) => r.data) });
  const { data: clientsData } = useQuery({
    queryKey: ["clients-calendar"],
    queryFn: () => api.get("/clients/?limit=200").then((r) => r.data),
  });

  const hubMeetingIds = new Set((hub?.meetings_today ?? []).map((m) => m.id));
  const otherMeetings =
    (data?.items as MeetingItem[] | undefined)?.filter((m) => !hubMeetingIds.has(m.id)) ?? [];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search).get("meeting");
    if (p === "confirmed") toast.success("Cita confirmada. Gracias.");
    else if (p === "declined") toast.message("Has indicado que no podrás asistir.");
    else if (p === "already_declined") toast.info("Esta cita ya estaba marcada como rechazada.");
    if (p) {
      window.history.replaceState({}, "", "/calendar");
    }
  }, []);

  const closeMutation = useMutation({
    mutationFn: async ({ id, charged }: { id: string; charged: number }) => {
      await api.patch(`/scheduling/appointments/${id}`, { status: "completed", charged_price_cents: charged });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings-agenda-hub"] });
      qc.invalidateQueries({ queryKey: ["scheduling-panel"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
      toast.success("Atención cerrada y precio registrado.");
      setCloseAppt(null);
    },
    onError: () => toast.error("No se pudo cerrar la cita"),
  });

  const create = useMutation({
    mutationFn: (d: {
      title: string;
      description: string;
      start_time: string;
      end_time: string;
      meeting_url: string;
      client_id?: string | null;
    }) => api.post("/meetings/", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["meetings-agenda-hub"] });
      setShowForm(false);
      toast.success("Reunión creada");
    },
  });

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">Centro de operaciones</p>
          <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl text-on-surface">Agenda</h1>
          <p className="text-sm text-slate-600">
            Vista unificada de lo que ocurre <strong>hoy</strong> en la tienda: citas con profesional y cliente, reuniones con
            organizador, y tickets Kanban con responsable. Zona horaria: {hub?.timezone ?? "…"}.
          </p>
          {hub?.now_local_iso && (
            <p className="mt-2 text-xs font-medium text-slate-500">
              Hora local de referencia: {new Date(hub.now_local_iso).toLocaleString("es-CL")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/scheduling/panel"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Stethoscope className="h-4 w-4 text-primary" />
            Panel de atención
          </Link>
          <Link
            href="/scheduling"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Calendar className="h-4 w-4 text-primary" />
            Citas avanzadas
          </Link>
          <Link
            href="/kanban"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <LayoutGrid className="h-4 w-4 text-primary" />
            Tablero Kanban
          </Link>
        </div>
      </div>

      {!storeId ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Seleccioná una tienda para ver la agenda.</p>
      ) : hubLoading ? (
        <div className="flex justify-center py-16 text-slate-500">Cargando operaciones del día…</div>
      ) : !hub ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          No se pudo cargar el centro de operaciones. Revisá tu conexión o volvé a iniciar sesión.
        </p>
      ) : (
        <div className="mb-10 space-y-8">
          {!hub.scheduling_included && (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40">
              Tu rol no incluye la agenda de citas de la tienda; solo verás reuniones y tickets. Pedí el permiso{" "}
              <strong>ver agenda de tienda</strong> si necesitás el detalle de citas.
            </p>
          )}

          {hub.scheduling_included && (
            <section>
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
                <div className="grid gap-3 md:grid-cols-2">
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
                        {a.branch_name ? (
                          <p className="text-xs text-slate-500">
                            <strong>Sede:</strong> {a.branch_name}
                          </p>
                        ) : null}
                        {a.station_name ? (
                          <p className="text-xs text-slate-600">
                            <strong>Puesto:</strong> {a.station_name}
                          </p>
                        ) : null}
                        <p className="text-xs text-slate-500">{apptStatusLabel[a.status] ?? a.status}</p>
                        <div className="mt-2 flex flex-wrap gap-2 pt-1">
                          {a.ticket_id && (
                            <Link href="/kanban" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                              Ver ficha Kanban
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => { setCloseAppt(a); setPriceInput(String(a.service_price_cents || 0)); }}
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
            </section>
          )}

          {hub.scheduling_included && hub.appointments_rest_today.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                  <Calendar className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                </div>
                <h2 className="text-lg font-bold text-on-surface">Más citas hoy</h2>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {hub.appointments_rest_today.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <p className="font-semibold text-on-surface">{a.service_name || "Servicio"}</p>
                    <p className="mt-1 text-xs text-slate-500">{fmtRange(a.start_time, a.end_time)}</p>
                    <p className="mt-2 text-slate-700 dark:text-slate-300">
                      <span className="text-slate-500">Profesional:</span> {a.professional_name || "—"}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">
                      <span className="text-slate-500">Cliente:</span> {a.client_name || "—"}
                    </p>
                    {a.station_name ? (
                      <p className="text-xs text-slate-500">
                        <span className="text-slate-500">Puesto:</span> {a.station_name}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                <Briefcase className="h-4 w-4 text-violet-700 dark:text-violet-300" />
              </div>
              <h2 className="text-lg font-bold text-on-surface">Reuniones hoy</h2>
            </div>
            {hub.meetings_today.length === 0 ? (
              <p className="text-sm text-slate-500">No hay reuniones agendadas para hoy.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {hub.meetings_today.map((m) => {
                  const su = statusUi[m.confirmation_status] || statusUi.scheduled;
                  return (
                    <div
                      key={m.id}
                      className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 dark:border-slate-700"
                    >
                      <h3 className="font-semibold text-on-surface">{m.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(m.start_time).toLocaleString("es-CL")} — {m.organizer_name || "Organizador"}
                        {m.organizer_email ? ` · ${m.organizer_email}` : ""}
                      </p>
                      <span className={clsx("mt-2 inline-flex rounded-md border px-2 py-0.5 text-[11px]", su.className)}>
                        {su.label}
                      </span>
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
                        <a
                          href={`${API_URL}/meetings/ics/${m.ics_token}`}
                          className="text-xs text-slate-500 hover:text-on-surface"
                        >
                          .ics
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                  <LayoutGrid className="h-4 w-4 text-amber-800 dark:text-amber-200" />
                </div>
                <h2 className="text-lg font-bold text-on-surface">Operaciones Kanban (activas)</h2>
              </div>
              <Link href="/kanban" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Abrir tablero <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            {hub.active_tickets.length === 0 ? (
              <p className="text-sm text-slate-500">No hay tickets fuera de cerrado.</p>
            ) : (
              <>
                {/* Cards en mobile */}
                <div className="space-y-2 sm:hidden">
                  {hub.active_tickets.map((t) => (
                    <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/20">
                      <p className="font-medium text-sm text-on-surface">{t.title}</p>
                      <p className="text-xs text-slate-500">{t.type}</p>
                      {t.extra_data?.appointment_id && (
                        <p className="mt-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">Vinculado a cita</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                          {t.assignee_name || "Sin asignar"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{t.status}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{t.priority}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Tabla en sm+ */}
                <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block dark:border-slate-700">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/50">
                      <tr>
                        <th className="px-4 py-3">Ticket</th>
                        <th className="px-4 py-3">Responsable</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Prioridad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {hub.active_tickets.map((t) => (
                        <tr key={t.id} className="bg-white dark:bg-slate-900/20">
                          <td className="px-4 py-3">
                            <p className="font-medium text-on-surface">{t.title}</p>
                            <p className="text-xs text-slate-500">{t.type}</p>
                            {t.extra_data?.appointment_id ? (
                              <p className="mt-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">Vinculado a cita</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                            {t.assignee_name ? t.assignee_name : <span className="italic text-slate-400">Sin asignar</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{t.status}</td>
                          <td className="px-4 py-3 text-slate-600">{t.priority}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <div className="mb-6 mt-10 flex flex-col gap-4 border-t border-slate-200 pt-10 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-3 rounded-2xl border border-tertiary/10 bg-tertiary/5 px-4 py-2">
            <MaterialIcon name="auto_awesome" className="text-tertiary text-xl" filled />
            <p className="text-sm font-medium text-tertiary">
              Las reuniones con cliente pueden enviar correo para confirmar o rechazar.
            </p>
          </div>
          <p className="mt-3 text-sm text-slate-500">Otras fechas y reuniones programadas</p>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary flex shrink-0 items-center gap-2 self-start sm:self-center">
          <Plus className="h-4 w-4" /> Nueva reunión
        </button>
      </div>
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card mb-6 p-6">
          <h2 className="mb-4 font-semibold text-on-surface">Nueva reunión</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="input-field md:col-span-2"
              placeholder="Título *"
            />
            <div>
              <label className="mb-1 block text-xs text-slate-500">Inicio</label>
              <input
                type="datetime-local"
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Fin</label>
              <input
                type="datetime-local"
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                className="input-field"
              />
            </div>
            <input
              value={form.meeting_url}
              onChange={(e) => setForm((f) => ({ ...f, meeting_url: e.target.value }))}
              className="input-field md:col-span-2"
              placeholder="URL de reunión (Jitsi, Meet, etc.)"
            />
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-slate-500">Cliente (opcional, para correo de confirmación)</label>
              <select
                value={form.client_id}
                onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                className="input-field"
              >
                <option value="">Sin cliente</option>
                {(clientsData?.items as { id: string; name: string; email: string | null }[] | undefined)?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.email ? ` (${c.email})` : " (sin email)"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() =>
                create.mutate({
                  ...form,
                  client_id: form.client_id || null,
                  start_time: new Date(form.start_time).toISOString(),
                  end_time: new Date(form.end_time).toISOString(),
                })
              }
              className="btn-primary"
            >
              Crear
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </motion.div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {otherMeetings.map((m: MeetingItem) => {
          const su = statusUi[m.confirmation_status] || statusUi.scheduled;
          return (
            <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-hover p-5">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-on-surface">{m.title}</h3>
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    {new Date(m.start_time).toLocaleString("es-CL")}
                  </div>
                  <span className={clsx("mt-2 inline-flex rounded-md border px-2 py-0.5 text-[11px]", su.className)}>{su.label}</span>
                </div>
              </div>
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
                <a
                  href={`${API_URL}/meetings/ics/${m.ics_token}`}
                  className="ml-auto flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-on-surface"
                >
                  Descargar .ics
                </a>
              </div>
            </motion.div>
          );
        })}
      </div>

      {closeAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl sm:p-6 dark:bg-slate-900 max-h-[calc(100dvh-2rem)] overflow-y-auto">
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
                onClick={() => {
                  const n = Math.max(0, Math.floor(Number(priceInput) || 0));
                  closeMutation.mutate({ id: closeAppt.id, charged: n });
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
