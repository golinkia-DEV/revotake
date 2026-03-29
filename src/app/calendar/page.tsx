"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, Plus, Clock, Link2 } from "lucide-react";
import api, { API_URL } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { useState } from "react";
import { toast } from "sonner";

interface MeetingItem {
  id: string;
  title: string;
  client_id: string | null;
  start_time: string;
  end_time: string;
  meeting_url: string | null;
  ics_token: string;
}

export default function CalendarPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", start_time: "", end_time: "", meeting_url: "" });

  const { data } = useQuery({ queryKey: ["meetings"], queryFn: () => api.get("/meetings/").then(r => r.data) });

  const create = useMutation({
    mutationFn: (d: { title: string; description: string; start_time: string; end_time: string; meeting_url: string }) => api.post("/meetings/", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meetings"] }); setShowForm(false); toast.success("Reunion creada"); },
  });

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Agenda</h1>
          <p className="text-gray-400">Reuniones y citas programadas</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva reunion
        </button>
      </div>
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-6">
          <h2 className="font-semibold text-white mb-4">Nueva reunion</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-field md:col-span-2" placeholder="Titulo *" />
            <div><label className="text-xs text-gray-400 mb-1 block">Inicio</label><input type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="input-field" /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Fin</label><input type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="input-field" /></div>
            <input value={form.meeting_url} onChange={e => setForm(f => ({ ...f, meeting_url: e.target.value }))} className="input-field md:col-span-2" placeholder="URL de reunion (Jitsi, Meet, etc.)" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => create.mutate({ ...form, start_time: new Date(form.start_time).toISOString(), end_time: new Date(form.end_time).toISOString() })} className="btn-primary">Crear</button>
            <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
          </div>
        </motion.div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data?.items?.map((m: MeetingItem) => (
          <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-hover p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-600/50 to-orange-600/50 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-yellow-300" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{m.title}</h3>
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                  <Clock className="w-3 h-3" />
                  {new Date(m.start_time).toLocaleString("es-CL")}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {m.meeting_url && (
                <a href={m.meeting_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                  <Link2 className="w-3 h-3" /> Entrar
                </a>
              )}
              <a href={`${API_URL}/meetings/ics/${m.ics_token}`} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors ml-auto">
                Descargar .ics
              </a>
            </div>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
