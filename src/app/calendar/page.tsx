"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, Plus, Clock, Link2 } from "lucide-react";
import api, { API_URL } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import clsx from "clsx";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

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

const statusUi: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Recordatorio pendiente", className: "bg-slate-100 text-slate-700 border-slate-200" },
  awaiting: { label: "Pendiente confirmación", className: "bg-amber-50 text-amber-800 border-amber-200" },
  confirmed: { label: "Confirmada", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  declined: { label: "Rechazada", className: "bg-red-50 text-red-800 border-red-200" },
};

export default function CalendarPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    meeting_url: "",
    client_id: "",
  });

  const { data } = useQuery({ queryKey: ["meetings"], queryFn: () => api.get("/meetings/").then((r) => r.data) });
  const { data: clientsData } = useQuery({
    queryKey: ["clients-calendar"],
    queryFn: () => api.get("/clients/?limit=200").then((r) => r.data),
  });

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
      setShowForm(false);
      toast.success("Reunión creada");
    },
  });

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-on-surface">Agenda inteligente</h1>
          <div className="inline-flex items-center gap-3 rounded-2xl border border-tertiary/10 bg-tertiary/5 px-4 py-2">
            <MaterialIcon name="auto_awesome" className="text-tertiary text-xl" filled />
            <p className="text-sm font-medium text-tertiary">
              Las citas con cliente reciben recordatorio por correo para confirmar o rechazar.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-surface-container-low p-1.5">
          <span className="rounded-xl bg-surface-container-lowest px-4 py-2 text-sm font-bold text-primary shadow-sm">Lista</span>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">Reuniones y citas programadas</p>
        <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
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
              <input type="datetime-local" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Fin</label>
              <input type="datetime-local" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} className="input-field" />
            </div>
            <input
              value={form.meeting_url}
              onChange={(e) => setForm((f) => ({ ...f, meeting_url: e.target.value }))}
              className="input-field md:col-span-2"
              placeholder="URL de reunión (Jitsi, Meet, etc.)"
            />
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-slate-500">Cliente (opcional, para correo de confirmación)</label>
              <select value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))} className="input-field">
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
        {data?.items?.map((m: MeetingItem) => {
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
    </AppLayout>
  );
}
