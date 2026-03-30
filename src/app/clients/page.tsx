"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Search, Mail, Phone, Trash2, User, CalendarDays, Pencil, X } from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { useState } from "react";

interface ClientItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
  preferences?: Record<string, unknown>;
}

const EMPTY_FORM = { name: "", email: "", phone: "", address: "", notes: "", next_contact_date: "" };

export default function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data } = useQuery({
    queryKey: ["clients", search],
    queryFn: () => api.get(`/clients/?search=${search}&limit=100`).then((r) => r.data),
  });

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(c: ClientItem) {
    setEditingId(c.id);
    setForm({
      name: c.name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      address: c.address ?? "",
      notes: c.notes ?? "",
      next_contact_date: typeof c.preferences?.next_contact_date === "string" ? c.preferences.next_contact_date : "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  const create = useMutation({
    mutationFn: (d: typeof form) => {
      const { next_contact_date, ...rest } = d;
      const preferences: Record<string, string> = {};
      if (next_contact_date) preferences.next_contact_date = next_contact_date;
      return api.post("/clients/", { ...rest, preferences });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      closeForm();
      toast.success("Cliente creado");
    },
  });

  const update = useMutation({
    mutationFn: (d: typeof form) => {
      const { next_contact_date, ...rest } = d;
      const preferences: Record<string, string> = {};
      if (next_contact_date) preferences.next_contact_date = next_contact_date;
      return api.put(`/clients/${editingId}`, { ...rest, preferences });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      closeForm();
      toast.success("Cliente actualizado");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente eliminado");
    },
  });

  const isPending = create.isPending || update.isPending;

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">CRM</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Clientes</h1>
          <p className="mt-1 text-slate-500">{data?.total ?? 0} clientes registrados</p>
          <p className="mt-2 max-w-xl text-sm text-slate-600">
            Alta sencilla: nombre obligatorio; el resto es opcional. Usa el <strong>calendario</strong> para anotar cuándo quieres volver a contactar a la
            persona (se guarda como recordatorio en su ficha).
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary self-start">
          <Plus className="h-4 w-4" /> Nuevo cliente
        </button>
      </div>
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card mb-6 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-on-surface">{editingId ? "Editar cliente" : "Nuevo cliente"}</h2>
              <p className="text-sm text-slate-500">
                {editingId ? "Modifica los datos y guarda." : "Completa los datos básicos. El calendario es opcional y ayuda a planificar seguimientos."}
              </p>
            </div>
            <button type="button" onClick={closeForm} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
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
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <CalendarDays className="h-4 w-4 text-primary" />
                Próximo contacto o seguimiento (opcional)
              </label>
              <input
                type="date"
                value={form.next_contact_date}
                onChange={(e) => setForm((f) => ({ ...f, next_contact_date: e.target.value }))}
                className="input-field max-w-xs"
              />
              <p className="mt-2 text-xs text-slate-500">Elige una fecha con el calendario del navegador; quedará guardada en la ficha del cliente.</p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={!form.name.trim() || isPending}
              onClick={() => editingId ? update.mutate(form) : create.mutate(form)}
              className="btn-primary disabled:opacity-50"
            >
              {editingId ? "Guardar cambios" : "Crear cliente"}
            </button>
            <button type="button" onClick={closeForm} className="btn-ghost">
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
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(client)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate(client.id)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
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
            {typeof client.preferences?.next_contact_date === "string" && client.preferences.next_contact_date && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/5 px-2 py-1.5 text-xs font-medium text-primary">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                Seguimiento: {new Date(`${client.preferences.next_contact_date}T12:00:00`).toLocaleDateString("es-CL", { dateStyle: "long" })}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
