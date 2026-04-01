"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, UserCircle, AlertCircle, CheckCircle2, XCircle, Loader2, CalendarDays, Clock } from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import clsx from "clsx";

type StaffMe = {
  linked: boolean;
  professionals: { id: string; name: string; email: string | null }[];
  message: string | null;
};

type ApptItem = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  client_name: string | null;
  service_name: string | null;
  branch_name: string | null;
  notes: string | null;
};

const statusLabel: Record<string, string> = {
  pending_payment: "Pago pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No asistió",
};

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

function getStatusBadgeColor(status: string): "emerald" | "amber" | "rose" | "blue" | "slate" | "purple" {
  if (status === "confirmed") return "emerald";
  if (status === "completed") return "blue";
  if (status === "cancelled") return "slate";
  if (status === "no_show") return "rose";
  if (status === "pending_payment") return "amber";
  return "slate";
}

function getStatusBorderColor(status: string): string {
  if (status === "confirmed") return "border-l-emerald-500";
  if (status === "completed") return "border-l-blue-500";
  if (status === "cancelled") return "border-l-slate-300";
  if (status === "no_show") return "border-l-rose-500";
  if (status === "pending_payment") return "border-l-amber-500";
  return "border-l-slate-300";
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() ?? "?";
}

function hashColor(name: string | null): string {
  if (!name) return "bg-slate-400";
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500",
    "bg-amber-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function isActiveNow(start: string, end: string): boolean {
  const now = Date.now();
  return new Date(start).getTime() <= now && new Date(end).getTime() >= now;
}

function groupByDay(items: ApptItem[]): { label: string; dateKey: string; items: ApptItem[] }[] {
  const map = new Map<string, ApptItem[]>();
  for (const a of items) {
    const key = a.start_time.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  const groups: { label: string; dateKey: string; items: ApptItem[] }[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  for (const [dateKey, appts] of map) {
    let label = "";
    if (dateKey === today) {
      label = `Hoy · ${new Date(dateKey + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}`;
    } else if (dateKey === tomorrow) {
      label = `Mañana · ${new Date(dateKey + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}`;
    } else {
      label = new Date(dateKey + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    groups.push({ label, dateKey, items: appts });
  }
  return groups.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export default function MiAgendaPage() {
  const qc = useQueryClient();
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["scheduling-staff-me"],
    queryFn: () => api.get("/scheduling/staff/me").then((r) => r.data as StaffMe),
  });

  const { data: appts, isLoading: apptsLoading } = useQuery({
    queryKey: ["scheduling-staff-appointments"],
    queryFn: () => api.get("/scheduling/staff/appointments").then((r) => r.data),
    enabled: !!me?.linked,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/scheduling/staff/appointments/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduling-staff-appointments"] }),
  });

  if (meLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppLayout>
    );
  }

  if (!me?.linked) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-lg">
          <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">Mi agenda</h1>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-950/30"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-100">Perfil no vinculado</p>
              <p className="mt-2 text-sm text-amber-800/90 dark:text-amber-200/90">
                {me?.message ??
                  "Un administrador de la tienda debe asociar tu cuenta de usuario a un profesional en Citas → Profesionales (campo usuario)."}
              </p>
            </div>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  const items: ApptItem[] = appts?.items ?? [];
  const todayItems = items.filter((a) => a.start_time.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const groups = groupByDay(items);

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mi Agenda</h1>
          <p className="mt-1 text-sm text-slate-500">
            {me.professionals.map((p) => p.name).join(", ")}
            {todayItems.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                {todayItems.length} {todayItems.length === 1 ? "cita hoy" : "citas hoy"}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800">
          <UserCircle className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-slate-700 dark:text-slate-200">Vista profesional</span>
        </div>
      </div>

      {apptsLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : items.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-20 text-center dark:border-slate-700">
          <CalendarDays className="mb-4 h-14 w-14 text-slate-300 dark:text-slate-600" />
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No tienes citas programadas</p>
          <p className="mt-1 text-sm text-slate-500">Las nuevas reservas aparecerán aquí agrupadas por día.</p>
          <button
            type="button"
            className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all"
          >
            Ver disponibilidad
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.dateKey}>
              {/* Sticky day header */}
              <div className="sticky top-14 z-10 mb-3 rounded-xl bg-slate-50/90 px-4 py-2.5 backdrop-blur-sm dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize">{group.label}</p>
              </div>

              <div className="space-y-3">
                {group.items.map((a) => {
                  const active = isActiveNow(a.start_time, a.end_time);
                  const borderColor = active ? "border-l-blue-500" : getStatusBorderColor(a.status);

                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={clsx(
                        "relative flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900",
                        "border-l-4",
                        borderColor,
                        active && "ring-2 ring-blue-500/20"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div
                          className={clsx(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                            hashColor(a.client_name)
                          )}
                        >
                          {getInitials(a.client_name)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {a.client_name ?? "Cliente sin nombre"}
                            </p>
                            {active && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                                En curso
                              </span>
                            )}
                            <Badge color={getStatusBadgeColor(a.status)}>
                              {statusLabel[a.status] ?? a.status}
                            </Badge>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(a.start_time).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                              {" – "}
                              {new Date(a.end_time).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {a.service_name && <span>{a.service_name}</span>}
                            {a.branch_name && <span className="text-slate-400">· {a.branch_name}</span>}
                          </div>

                          {a.notes && (
                            <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {a.notes}
                            </p>
                          )}
                        </div>

                        {/* Acciones inline */}
                        {(a.status === "confirmed" || a.status === "pending_payment") && (
                          <div className="flex shrink-0 items-center gap-1.5">
                            {a.status === "confirmed" && (
                              <button
                                type="button"
                                disabled={patchMutation.isPending}
                                onClick={() => patchMutation.mutate({ id: a.id, status: "completed" })}
                                title="Marcar como completada"
                                className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 transition-colors dark:bg-emerald-900/30 dark:text-emerald-400"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            )}
                            {a.status === "confirmed" && (
                              <button
                                type="button"
                                disabled={patchMutation.isPending}
                                onClick={() => patchMutation.mutate({ id: a.id, status: "no_show" })}
                                title="No asistió"
                                className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-50 transition-colors dark:bg-rose-900/30 dark:text-rose-400"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={patchMutation.isPending}
                              onClick={() => patchMutation.mutate({ id: a.id, status: "cancelled" })}
                              title="Cancelar cita"
                              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition-colors dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
