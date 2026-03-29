"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, UserCircle, AlertCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
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
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!me?.linked) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-lg">
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-on-surface">Mi agenda</h1>
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

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-on-surface">Mi agenda</h1>
          <p className="text-sm text-slate-500">
            Tus citas en esta tienda como{" "}
            {me.professionals.map((p) => p.name).join(", ")}.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800">
          <UserCircle className="h-5 w-5 text-primary" />
          <span className="font-medium text-on-surface">Vista trabajadora</span>
        </div>
      </div>

      {apptsLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
          No hay citas en el rango mostrado. Las nuevas reservas aparecerán aquí.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card-hover flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-on-surface">
                    {new Date(a.start_time).toLocaleString("es-CL", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {a.service_name ?? "Servicio"} · {a.branch_name ?? "Sucursal"}
                  </p>
                  <p className="text-sm text-slate-500">Cliente: {a.client_name ?? "—"}</p>
                  <span
                    className={clsx(
                      "mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-medium",
                      a.status === "confirmed" && "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30",
                      a.status === "cancelled" && "bg-slate-100 text-slate-600",
                      a.status === "completed" && "bg-blue-50 text-blue-800",
                      a.status === "no_show" && "bg-red-50 text-red-800"
                    )}
                  >
                    {statusLabel[a.status] ?? a.status}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {a.status === "confirmed" && (
                  <>
                    <button
                      type="button"
                      disabled={patchMutation.isPending}
                      onClick={() => patchMutation.mutate({ id: a.id, status: "completed" })}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Atendida
                    </button>
                    <button
                      type="button"
                      disabled={patchMutation.isPending}
                      onClick={() => patchMutation.mutate({ id: a.id, status: "no_show" })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600"
                    >
                      No asistió
                    </button>
                  </>
                )}
                {(a.status === "confirmed" || a.status === "pending_payment") && (
                  <button
                    type="button"
                    disabled={patchMutation.isPending}
                    onClick={() => patchMutation.mutate({ id: a.id, status: "cancelled" })}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Cancelar
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
