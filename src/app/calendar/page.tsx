"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Plus, Clock, Link2, Stethoscope,
  LayoutGrid, ExternalLink, UserCircle, CheckCircle2, Loader2,
  ChevronLeft, ChevronRight, X, Building2, User, AlertCircle,
  Phone, Mail, MapPin, DollarSign, Tag, Ban,
} from "lucide-react";
import api, { API_URL } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import clsx from "clsx";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import Link from "next/link";
import { getStoreId } from "@/lib/store";
import { PhoneQuickBookingForm } from "@/components/scheduling/PhoneQuickBookingForm";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MeetingItem {
  id: string; title: string; client_id: string | null; start_time: string;
  end_time: string; meeting_url: string | null; ics_token: string; confirmation_status: string;
}
interface HubAppointment {
  id: string; start_time: string; end_time: string; status: string;
  professional_name: string; service_name: string; client_name: string;
  branch_name: string; station_name?: string; ticket_id: string | null;
  in_progress: boolean; service_price_cents: number; allow_price_override: boolean;
}
interface HubMeeting {
  id: string; title: string; client_id: string | null; start_time: string; end_time: string;
  meeting_url: string | null; ics_token: string; confirmation_status: string;
  organizer_name: string; organizer_email: string;
}
interface HubTicket {
  id: string; title: string; type: string; status: string; priority: string;
  client_id: string | null; due_date: string | null; assigned_to: string | null;
  assignee_name: string; extra_data?: { appointment_id?: string };
}
interface AgendaHub {
  timezone: string; now_local_iso: string;
  appointments_in_progress: HubAppointment[]; appointments_rest_today: HubAppointment[];
  meetings_today: HubMeeting[]; active_tickets: HubTicket[]; scheduling_included: boolean;
}
interface BranchRow { id: string; name: string; slug: string; is_active: boolean; }
interface ProfessionalRow { id: string; name: string; email: string | null; branch_ids: string[]; }
interface ServiceRow { id: string; name: string; }
interface ProAppointment {
  id: string; start_time: string; end_time: string; status: string;
  service_name: string; client_name: string; client_phone?: string; client_email?: string;
  branch_name: string; station_name?: string; professional_name: string;
  service_price_cents: number; charged_price_cents?: number;
  payment_mode: string; payment_status: string; allow_price_override: boolean;
  ticket_id: string | null; in_progress: boolean; notes?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusUi: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Recordatorio pendiente", className: "bg-slate-100 text-slate-700 border-slate-200" },
  awaiting: { label: "Pendiente confirmación", className: "bg-amber-50 text-amber-800 border-amber-200" },
  confirmed: { label: "Confirmada", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  declined: { label: "Rechazada", className: "bg-red-50 text-red-800 border-red-200" },
};

const apptStatusConfig: Record<string, { label: string; color: string }> = {
  pending_payment: { label: "Pago pendiente", color: "bg-amber-100 text-amber-800 border-amber-200" },
  confirmed: { label: "Confirmada", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800 border-red-200" },
  completed: { label: "Completada", color: "bg-slate-100 text-slate-700 border-slate-200" },
  no_show: { label: "No asistió", color: "bg-orange-100 text-orange-800 border-orange-200" },
  in_progress: { label: "En curso", color: "bg-blue-100 text-blue-800 border-blue-200" },
};

function fmtCLP(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}
function fmtRange(start: string, end: string) {
  const a = new Date(start); const b = new Date(end);
  return `${a.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} – ${b.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}
function startOfWeek(d: Date) {
  const date = new Date(d); date.setHours(0, 0, 0, 0);
  const day = date.getDay(); const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff); return date;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

// ─── Pro Calendar Week View ───────────────────────────────────────────────────

const HOUR_START = 7;
const HOUR_END = 22;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const CELL_H = 64; // px per hour

function ProCalendar({ appointments, weekStart, onSelectAppt }: {
  appointments: ProAppointment[]; weekStart: Date; onSelectAppt: (a: ProAppointment) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i);
  const today = isoDate(new Date());

  function apptForDay(dayIso: string) {
    return appointments.filter((a) => {
      const d = new Date(a.start_time);
      return isoDate(d) === dayIso && a.status !== "cancelled";
    });
  }

  function apptTop(start: string) {
    const d = new Date(start);
    const h = d.getHours() + d.getMinutes() / 60;
    return Math.max(0, (h - HOUR_START) * CELL_H);
  }

  function apptHeight(start: string, end: string) {
    const s = new Date(start); const e = new Date(end);
    const mins = (e.getTime() - s.getTime()) / 60000;
    return Math.max(24, (mins / 60) * CELL_H);
  }

  const statusColors: Record<string, string> = {
    confirmed: "bg-primary/90 text-white",
    pending_payment: "bg-amber-500/90 text-white",
    completed: "bg-slate-400 text-white",
    no_show: "bg-red-400 text-white",
    in_progress: "bg-emerald-500 text-white ring-2 ring-emerald-300",
    cancelled: "bg-slate-200 text-slate-400 line-through",
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* Day headers */}
      <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="w-14 shrink-0 border-r border-slate-100 dark:border-slate-800" />
        {days.map((day) => {
          const iso = isoDate(day);
          const isToday = iso === today;
          return (
            <div key={iso} className="flex-1 min-w-[100px] border-r border-slate-100 px-2 py-3 text-center last:border-r-0 dark:border-slate-800">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {day.toLocaleDateString("es-CL", { weekday: "short" })}
              </p>
              <div className={clsx("mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                isToday ? "bg-primary text-white" : "text-on-surface")}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex" style={{ height: `${TOTAL_HOURS * CELL_H}px` }}>
        {/* Hour labels */}
        <div className="w-14 shrink-0 border-r border-slate-100 dark:border-slate-800">
          {hours.map((h) => (
            <div key={h} style={{ height: CELL_H }} className="relative">
              <span className="absolute -top-2.5 right-2 text-[10px] font-medium text-slate-400">
                {h}:00
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const iso = isoDate(day);
          const dayAppts = apptForDay(iso);
          const isToday = iso === today;
          return (
            <div key={iso} className="relative flex-1 min-w-[100px] border-r border-slate-100 last:border-r-0 dark:border-slate-800">
              {/* Hour lines */}
              {hours.map((h) => (
                <div key={h} style={{ top: (h - HOUR_START) * CELL_H, height: CELL_H }}
                  className={clsx("absolute inset-x-0 border-t", isToday ? "border-primary/10" : "border-slate-100 dark:border-slate-800/60")} />
              ))}

              {/* Appointments */}
              {dayAppts.map((a) => {
                const top = apptTop(a.start_time);
                const height = apptHeight(a.start_time, a.end_time);
                const status = a.in_progress ? "in_progress" : a.status;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSelectAppt(a)}
                    style={{ top, height, left: 2, right: 2 }}
                    className={clsx(
                      "absolute rounded-lg px-1.5 py-1 text-left text-xs font-medium shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md focus:outline-none",
                      statusColors[status] ?? "bg-slate-400 text-white"
                    )}
                  >
                    <p className="truncate font-semibold leading-tight">{a.service_name}</p>
                    {height > 36 && <p className="truncate opacity-90">{a.client_name}</p>}
                    {height > 56 && <p className="truncate opacity-75">{fmtTime(a.start_time)}</p>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Appointment Detail Panel ─────────────────────────────────────────────────

function ApptDetailPanel({ appt, onClose, onClose2, onCancel }: {
  appt: ProAppointment; onClose: () => void;
  onClose2: (id: string, charged: number) => void; onCancel: (id: string) => void;
}) {
  const [priceInput, setPriceInput] = useState(String(appt.service_price_cents || 0));
  const statusCfg = appt.in_progress ? apptStatusConfig.in_progress : (apptStatusConfig[appt.status] ?? { label: appt.status, color: "bg-slate-100 text-slate-700 border-slate-200" });

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div>
          <h3 className="font-bold text-on-surface">{appt.service_name}</h3>
          <p className="text-xs text-slate-500">{fmtRange(appt.start_time, appt.end_time)}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className={clsx("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", statusCfg.color)}>
            {statusCfg.label}
          </span>
          {appt.in_progress && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> En curso ahora
            </span>
          )}
        </div>

        {/* Client info */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Cliente</p>
          <div className="flex items-center gap-2 text-sm">
            <UserCircle className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-semibold text-on-surface">{appt.client_name || "Sin nombre"}</span>
          </div>
          {appt.client_phone && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Phone className="h-4 w-4 shrink-0" />
              <a href={`tel:${appt.client_phone}`} className="hover:text-primary hover:underline">{appt.client_phone}</a>
            </div>
          )}
          {appt.client_email && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Mail className="h-4 w-4 shrink-0" />
              <a href={`mailto:${appt.client_email}`} className="hover:text-primary hover:underline truncate">{appt.client_email}</a>
            </div>
          )}
        </div>

        {/* Service + location */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Detalle de cita</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Tag className="h-4 w-4 shrink-0 text-secondary" />
              <span>{appt.service_name}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <User className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{appt.professional_name || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{appt.branch_name || "—"}</span>
            </div>
            {appt.station_name && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <MaterialIcon name="chair" className="text-base shrink-0" />
                <span>{appt.station_name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{fmtRange(appt.start_time, appt.end_time)}</span>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Pago</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Precio lista</span>
            <span className="font-semibold">{fmtCLP(appt.service_price_cents)}</span>
          </div>
          {appt.charged_price_cents != null && appt.charged_price_cents !== appt.service_price_cents && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Cobrado</span>
              <span className="font-semibold text-primary">{fmtCLP(appt.charged_price_cents)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Modo</span>
            <span>{appt.payment_mode === "online" ? "Online" : "En sitio"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Estado pago</span>
            <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium",
              appt.payment_status === "paid" ? "bg-emerald-100 text-emerald-800" :
              appt.payment_status === "pending" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
            )}>
              {appt.payment_status === "paid" ? "Pagado" : appt.payment_status === "pending" ? "Pendiente" : appt.payment_status}
            </span>
          </div>
        </div>

        {/* Close & charge */}
        {(appt.status === "confirmed" || appt.in_progress) && appt.status !== "completed" && appt.status !== "cancelled" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
            <p className="mb-3 text-sm font-semibold text-emerald-800 dark:text-emerald-300">Cerrar y cobrar</p>
            <div>
              <label className="mb-1 block text-xs text-emerald-700 dark:text-emerald-400">Monto cobrado (CLP)</label>
              <input
                type="number" min={0} className="input-field" value={priceInput}
                disabled={!appt.allow_price_override}
                onChange={(e) => setPriceInput(e.target.value)}
              />
              {!appt.allow_price_override && (
                <p className="mt-1 text-[11px] text-slate-500">Precio fijo — no se permite ajuste</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onClose2(appt.id, Math.max(0, Math.floor(Number(priceInput) || 0)))}
              className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="inline h-4 w-4 mr-1" /> Confirmar cierre
            </button>
          </div>
        )}

        {/* Notes */}
        {appt.notes && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Notas internas</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3">{appt.notes}</p>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-slate-200 p-4 space-y-2 dark:border-slate-700">
        {appt.ticket_id && (
          <Link href="/kanban" className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <LayoutGrid className="h-4 w-4 text-primary" /> Ver en Kanban
          </Link>
        )}
        {appt.status !== "cancelled" && appt.status !== "completed" && (
          <button
            type="button"
            onClick={() => onCancel(appt.id)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/20"
          >
            <Ban className="h-4 w-4" /> Cancelar cita
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const qc = useQueryClient();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;

  // Hub (today overview)
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", start_time: "", end_time: "", meeting_url: "", client_id: "" });

  // Pro calendar
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedPro, setSelectedPro] = useState<string>("");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [selectedAppt, setSelectedAppt] = useState<ProAppointment | null>(null);
  const [showProCal, setShowProCal] = useState(true);
  const [proViewMode, setProViewMode] = useState<"calendar" | "list">("calendar");

  const weekEnd = addDays(weekStart, 6);

  // Queries
  const { data: hub, isLoading: hubLoading } = useQuery({
    queryKey: ["meetings-agenda-hub", storeId],
    queryFn: () => api.get("/meetings/agenda-hub").then((r) => r.data as AgendaHub),
    enabled: !!storeId,
    refetchInterval: 60_000,
  });
  const { data } = useQuery({ queryKey: ["meetings"], queryFn: () => api.get("/meetings/").then((r) => r.data) });
  const { data: clientsData } = useQuery({ queryKey: ["clients-calendar"], queryFn: () => api.get("/clients/?limit=200").then((r) => r.data) });

  const { data: branchesData } = useQuery({
    queryKey: ["scheduling-branches", storeId],
    queryFn: () => api.get("/scheduling/branches").then((r) => r.data),
    enabled: !!storeId,
  });
  const { data: professionalsData } = useQuery({
    queryKey: ["scheduling-professionals", storeId],
    queryFn: () => api.get("/scheduling/professionals").then((r) => r.data),
    enabled: !!storeId,
  });
  const { data: servicesData } = useQuery({
    queryKey: ["scheduling-services", storeId],
    queryFn: () => api.get("/scheduling/services").then((r) => r.data),
    enabled: !!storeId,
  });
  const branches: BranchRow[] = branchesData?.items ?? [];
  const allProfessionals: ProfessionalRow[] = professionalsData?.items ?? [];
  const services: ServiceRow[] = servicesData?.items ?? [];

  const filteredPros = useMemo(() => {
    if (!selectedBranch) return allProfessionals;
    return allProfessionals.filter((p) => p.branch_ids?.includes(selectedBranch));
  }, [selectedBranch, allProfessionals]);

  // Reset pro when branch changes
  useEffect(() => {
    setSelectedPro("");
  }, [selectedBranch]);

  // Fetch appointments for selected professional + week
  const { data: proApptData, isLoading: proApptLoading } = useQuery({
    queryKey: ["pro-appointments", storeId, selectedPro, isoDate(weekStart)],
    queryFn: () => api.get(`/scheduling/appointments`, {
      params: { professional_id: selectedPro || undefined, branch_id: selectedBranch || undefined, from_date: isoDate(weekStart), to_date: isoDate(weekEnd), limit: 400 }
    }).then((r) => r.data),
    enabled: !!storeId,
  });
  const proAppointments: ProAppointment[] = proApptData?.items ?? [];

  const hubMeetingIds = new Set((hub?.meetings_today ?? []).map((m) => m.id));
  const otherMeetings = (data?.items as MeetingItem[] | undefined)?.filter((m) => !hubMeetingIds.has(m.id)) ?? [];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search).get("meeting");
    if (p === "confirmed") toast.success("Cita confirmada. Gracias.");
    else if (p === "declined") toast.message("Has indicado que no podrás asistir.");
    else if (p === "already_declined") toast.info("Esta cita ya estaba marcada como rechazada.");
    if (p) window.history.replaceState({}, "", "/calendar");
  }, []);

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
      setSelectedAppt(null);
    },
    onError: () => toast.error("No se pudo cerrar la cita"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/scheduling/appointments/${id}`, { status: "cancelled" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings-agenda-hub"] });
      qc.invalidateQueries({ queryKey: ["pro-appointments"] });
      toast.success("Cita cancelada");
      setSelectedAppt(null);
    },
    onError: () => toast.error("No se pudo cancelar"),
  });

  const create = useMutation({
    mutationFn: (d: typeof form & { client_id?: string | null }) => api.post("/meetings/", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["meetings-agenda-hub"] });
      setShowForm(false); toast.success("Reunión creada");
    },
  });

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">Centro de operaciones</p>
          <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl text-on-surface">Agenda</h1>
          <p className="text-sm text-slate-600">
            Vista del día y calendario completo por profesional. Zona horaria: {hub?.timezone ?? "…"}.
          </p>
          {hub?.now_local_iso && (
            <p className="mt-1 text-xs font-medium text-slate-500">
              {new Date(hub.now_local_iso).toLocaleString("es-CL")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/scheduling/panel" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Stethoscope className="h-4 w-4 text-primary" /> Panel de atención
          </Link>
          <Link href="/scheduling" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Calendar className="h-4 w-4 text-primary" /> Citas avanzadas
          </Link>
          <Link href="/kanban" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <LayoutGrid className="h-4 w-4 text-primary" /> Tablero Kanban
          </Link>
        </div>
      </div>

      {!storeId ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Seleccioná una tienda para ver la agenda.</p>
      ) : (
        <>
          {/* ── Calendario por profesional ── */}
          <div className="mb-10 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
            {/* Toggle header */}
            <button
              type="button"
              onClick={() => setShowProCal(!showProCal)}
              className="flex w-full items-center gap-4 rounded-2xl p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-on-surface">Calendario por profesional</h2>
                <p className="text-sm text-slate-500">Calendario semanal completo por defecto (hoy marcado), con vista calendario o lista.</p>
              </div>
              <ChevronRight className={clsx("h-5 w-5 text-slate-400 transition-transform", showProCal && "rotate-90")} />
            </button>

            <AnimatePresence>
              {showProCal && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="border-t border-slate-200 p-5 dark:border-slate-700">

                    {/* Selectors */}
                    <div className="mb-5 flex flex-wrap gap-3 items-end">
                      <div className="min-w-[180px]">
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                          <Building2 className="inline h-3.5 w-3.5 mr-1" />Sede
                        </label>
                        <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="input-field">
                          <option value="">Todas las sedes</option>
                          {branches.filter((b) => b.is_active).map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="min-w-[200px]">
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                          <User className="inline h-3.5 w-3.5 mr-1" />Profesional
                        </label>
                        <select value={selectedPro} onChange={(e) => setSelectedPro(e.target.value)} className="input-field">
                          <option value="">Todas las profesionales</option>
                          {filteredPros.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-end gap-2 ml-auto">
                        <div className="mr-2 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
                          <button type="button" onClick={() => setProViewMode("calendar")} className={clsx("rounded px-2 py-1 text-xs", proViewMode === "calendar" ? "bg-primary text-white" : "text-slate-600")}>Calendario</button>
                          <button type="button" onClick={() => setProViewMode("list")} className={clsx("rounded px-2 py-1 text-xs", proViewMode === "list" ? "bg-primary text-white" : "text-slate-600")}>Lista</button>
                        </div>
                        <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                          Hoy
                        </button>
                        <button type="button" onClick={() => setWeekStart((w) => addDays(w, -7))}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-medium text-on-surface whitespace-nowrap px-1">
                          {weekStart.toLocaleDateString("es-CL", { day: "numeric", month: "short" })} – {weekEnd.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                        <button type="button" onClick={() => setWeekStart((w) => addDays(w, 7))}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {proApptLoading ? (
                      <div className="flex justify-center py-16 text-slate-500">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : (
                      <>
                        {/* Legend */}
                        <div className="mb-3 flex flex-wrap gap-3 text-xs">
                          {[
                            { label: "Confirmada", color: "bg-primary/90" },
                            { label: "Pago pend.", color: "bg-amber-500/90" },
                            { label: "En curso", color: "bg-emerald-500" },
                            { label: "Completada", color: "bg-slate-400" },
                            { label: "No asistió", color: "bg-red-400" },
                          ].map(({ label, color }) => (
                            <span key={label} className="flex items-center gap-1.5 text-slate-500">
                              <span className={clsx("h-3 w-3 rounded-sm", color)} />{label}
                            </span>
                          ))}
                        </div>

                        {proViewMode === "calendar" ? (
                          <ProCalendar
                            appointments={proAppointments}
                            weekStart={weekStart}
                            onSelectAppt={setSelectedAppt}
                          />
                        ) : (
                          <div className="space-y-2 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                            {proAppointments.length === 0 && <p className="text-sm text-slate-500">Sin citas esta semana.</p>}
                            {proAppointments.map((a) => (
                              <button key={a.id} type="button" onClick={() => setSelectedAppt(a)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm dark:border-slate-700">
                                <span className="font-medium text-on-surface">{a.client_name} · {a.service_name}</span>
                                <span className="text-xs text-slate-500">{new Date(a.start_time).toLocaleString("es-CL")}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {proAppointments.length === 0 && (
                          <p className="mt-4 text-center text-sm text-slate-400">Sin citas esta semana para los filtros seleccionados.</p>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Vista de hoy ── */}
          {hubLoading ? (
            <div className="flex justify-center py-16 text-slate-500">Cargando operaciones del día…</div>
          ) : !hub ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">No se pudo cargar el centro de operaciones.</p>
          ) : (
            <div className="mb-10 space-y-8">
              {!hub.scheduling_included && (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40">
                  Tu rol no incluye la agenda de citas de la tienda. Reuniones de hoy y atención en curso están en el{" "}
                  <Link href="/dashboard" className="font-semibold text-primary hover:underline">
                    panel principal
                  </Link>
                  .
                </p>
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
                      <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
                        <p className="font-semibold text-on-surface">{a.service_name || "Servicio"}</p>
                        <p className="mt-1 text-xs text-slate-500">{fmtRange(a.start_time, a.end_time)}</p>
                        <p className="mt-2 text-slate-700 dark:text-slate-300"><span className="text-slate-500">Profesional:</span> {a.professional_name || "—"}</p>
                        <p className="text-slate-600 dark:text-slate-400"><span className="text-slate-500">Cliente:</span> {a.client_name || "—"}</p>
                        {a.station_name && <p className="text-xs text-slate-500"><span>Puesto:</span> {a.station_name}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
            <PhoneQuickBookingForm syncBranch={{ value: selectedBranch, onChange: setSelectedBranch }} />
          </div>

          <p className="mb-10 text-sm text-slate-600 dark:text-slate-400">
            Gráfico de rendimiento de trabajadoras (90 días):{" "}
            <Link href="/dashboard" className="font-semibold text-primary hover:underline">
              ver en el panel principal
            </Link>
            .
          </p>

          {/* Nueva reunión */}
          <div className="mb-6 mt-10 flex flex-col gap-4 border-t border-slate-200 pt-10 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-3 rounded-2xl border border-tertiary/10 bg-tertiary/5 px-4 py-2">
                <MaterialIcon name="auto_awesome" className="text-tertiary text-xl" filled />
                <p className="text-sm font-medium text-tertiary">Las reuniones con cliente pueden enviar correo para confirmar o rechazar.</p>
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
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="input-field md:col-span-2" placeholder="Título *" />
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Inicio</label>
                  <input type="datetime-local" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Fin</label>
                  <input type="datetime-local" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} className="input-field" />
                </div>
                <input value={form.meeting_url} onChange={(e) => setForm((f) => ({ ...f, meeting_url: e.target.value }))} className="input-field md:col-span-2" placeholder="URL de reunión (Jitsi, Meet, etc.)" />
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-slate-500">Cliente (opcional)</label>
                  <select value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))} className="input-field">
                    <option value="">Sin cliente</option>
                    {(clientsData?.items as { id: string; name: string; email: string | null }[] | undefined)?.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.email ? ` (${c.email})` : " (sin email)"}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={() => { const payload = { ...form, client_id: form.client_id || null, start_time: new Date(form.start_time).toISOString(), end_time: new Date(form.end_time).toISOString() }; create.mutate(payload as Parameters<typeof create.mutate>[0]); }} className="btn-primary">Crear</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
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
                        <Clock className="h-3 w-3" />{new Date(m.start_time).toLocaleString("es-CL")}
                      </div>
                      <span className={clsx("mt-2 inline-flex rounded-md border px-2 py-0.5 text-[11px]", su.className)}>{su.label}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.meeting_url && (
                      <a href={m.meeting_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                        <Link2 className="h-3 w-3" /> Entrar
                      </a>
                    )}
                    <a href={`${API_URL}/meetings/ics/${m.ics_token}`} className="ml-auto flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-on-surface">Descargar .ics</a>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* Appointment detail side panel */}
      <AnimatePresence>
        {selectedAppt && (
          <>
            <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelectedAppt(null)} />
            <ApptDetailPanel
              appt={selectedAppt}
              onClose={() => setSelectedAppt(null)}
              onClose2={(id, charged) => closeMutation.mutate({ id, charged })}
              onCancel={(id) => cancelMutation.mutate(id)}
            />
          </>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
