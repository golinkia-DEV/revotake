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
    queryFn: () => api.get(`/clients/?search=${search}&limit=100`).then(r => r.data),
  });

  const create = useMutation({
    mutationFn: (data: typeof form) => api.post("/clients/", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setShowForm(false); setForm({ name: "", email: "", phone: "", address: "", notes: "" }); toast.success("Cliente creado"); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Cliente eliminado"); },
  });

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Clientes</h1>
          <p className="text-gray-400">{data?.total ?? 0} clientes registrados</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-6">
          <h2 className="font-semibold text-white mb-4">Nuevo cliente</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="Nombre *" />
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input-field" placeholder="Email" />
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" placeholder="Telefono" />
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="input-field" placeholder="Direccion" />
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input-field md:col-span-2 resize-none h-20" placeholder="Notas..." />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => create.mutate(form)} className="btn-primary">Crear cliente</button>
            <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
          </div>
        </motion.div>
      )}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-3 w-5 h-5 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-11" placeholder="Buscar clientes..." />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data?.items?.map((client: ClientItem) => (
          <motion.div key={client.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-hover p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600/50 to-purple-600/50 flex items-center justify-center">
                  <User className="w-5 h-5 text-brand-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{client.name}</h3>
                  <p className="text-xs text-gray-500">{new Date(client.created_at).toLocaleDateString("es-CL")}</p>
                </div>
              </div>
              <button onClick={() => remove.mutate(client.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {client.email && <div className="flex items-center gap-2 text-sm text-gray-400 mb-1"><Mail className="w-3.5 h-3.5" />{client.email}</div>}
            {client.phone && <div className="flex items-center gap-2 text-sm text-gray-400"><Phone className="w-3.5 h-3.5" />{client.phone}</div>}
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
