"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Search, Mail, Phone, Trash2, User } from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { useState } from "react";

interface ClientItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export default function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "" });

  const { data } = useQuery({
    queryKey: ["clients", search],
    queryFn: () => api.get(`/clients/?search=${search}&limit=100`).then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (data: typeof form) => api.post("/clients/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      setShowForm(false);
      setForm({ name: "", email: "", phone: "", address: "", notes: "" });
      toast.success("Cliente creado");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente eliminado");
    },
  });

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">CRM</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Clientes</h1>
          <p className="mt-1 text-slate-500">{data?.total ?? 0} clientes registrados</p>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary self-start">
          <Plus className="h-4 w-4" /> Nuevo cliente
        </button>
      </div>
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card mb-6 p-6">
          <h2 className="mb-4 font-semibold text-on-surface">Nuevo cliente</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input-field"
              placeholder="Nombre *"
            />
            <input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="input-field"
              placeholder="Email"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="input-field"
              placeholder="Teléfono"
            />
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="input-field"
              placeholder="Dirección"
            />
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="input-field md:col-span-2 h-20 resize-none"
              placeholder="Notas..."
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => create.mutate(form)} className="btn-primary">
              Crear cliente
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </motion.div>
      )}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field rounded-full pl-11"
          placeholder="Buscar clientes..."
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.items?.map((client: ClientItem) => (
          <motion.div key={client.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-hover p-5">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-on-surface">{client.name}</h3>
                  <p className="text-xs text-slate-500">{new Date(client.created_at).toLocaleDateString("es-CL")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove.mutate(client.id)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {client.email && (
              <div className="mb-1 flex items-center gap-2 text-sm text-slate-600">
                <Mail className="h-3.5 w-3.5" />
                {client.email}
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="h-3.5 w-3.5" />
                {client.phone}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
