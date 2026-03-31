"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Mail,
  Phone,
  MessageCircle,
  Trash2,
  User,
  CalendarDays,
  Pencil,
  X,
  ShoppingBag,
  Kanban,
  Video,
  Loader2,
} from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { getStoreId } from "@/lib/store";

interface ClientItem {
  id: string;
  name: string;
  paternal_last_name?: string | null;
  maternal_last_name?: string | null;
  birth_date?: string | null;
  rut?: string | null;
  address_lat?: number | null;
  address_lng?: number | null;
  email: string | null;
  phone: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
  preferences?: Record<string, unknown>;
}

type ActivityEvent =
  | {
      kind: "appointment";
      at: string;
      id: string;
      service_name: string;
      professional_id: string;
      professional_name: string;
      professional_is_active: boolean;
      branch_name: string;
      status: string;
      start_time: string;
      end_time: string;
      payment_status: string;
      charged_price_cents: number | null;
    }
  | {
      kind: "purchase";
      at: string;
      id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      total: number;
    }
  | {
      kind: "ticket";
      at: string;
      id: string;
      title: string;
      ticket_type: string;
      status: string;
      created_at: string;
    }
  | {
      kind: "meeting";
      at: string;
      id: string;
      title: string;
      organizer_name: string;
      confirmation_status: string;
      start_time: string;
      end_time: string;
    };

interface ClientActivityResponse {
  client: ClientItem & { custom_fields?: Record<string, unknown>; created_at: string | null };
  events: ActivityEvent[];
}

const APPOINTMENT_STATUS_ES: Record<string, string> = {
  pending_payment: "Pendiente de pago",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No asistió",
};

const TICKET_STATUS_ES: Record<string, string> = {
  new: "Nuevo",
  qualified: "Calificado",
  meeting_scheduled: "Reunión agendada",
  data_received: "Datos recibidos",
  sold: "Vendido",
  follow_up: "Seguimiento",
  no_response: "Sin respuesta",
  closed: "Cerrado",
};

const TICKET_TYPE_ES: Record<string, string> = {
  lead: "Lead",
  meeting: "Reunión",
  order: "Pedido",
  incident: "Incidencia",
  task: "Tarea",
};

function formatMoneyCl(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(
    Math.round(value),
  );
}

const EMPTY_FORM = {
  name: "",
  paternal_last_name: "",
  maternal_last_name: "",
  birth_date: "",
  rut: "",
  address_lat: "",
  address_lng: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  next_contact_date: "",
};

export default function ClientsPage() {
  const qc = useQueryClient();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [detailClientId, setDetailClientId] = useState<string | null>(null);
  const [workerNote, setWorkerNote] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data } = useQuery({
    queryKey: ["clients", debouncedSearch],
    queryFn: () => api.get(`/clients/?search=${encodeURIComponent(debouncedSearch)}&limit=100`).then((r) => r.data),
  });
  const { data: storesData } = useQuery({
    queryKey: ["my-stores-clients-map"],
    queryFn: () => api.get("/stores/").then((r) => r.data),
    enabled: !!storeId,
  });
  const selectedStore = storesData?.items?.find((s: { id: string; settings?: Record<string, unknown> }) => s.id === storeId);
  const mapProvider = ((selectedStore?.settings?.platform as Record<string, string> | undefined)?.map_provider ?? "google") as "google" | "mapbox";
  const mapQuery = encodeURIComponent(form.address || "Santiago Chile");
  const mapPin = form.address_lat && form.address_lng ? `${form.address_lat},${form.address_lng}` : "";

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ["client-activity", detailClientId],
    queryFn: () => api.get<ClientActivityResponse>(`/clients/${detailClientId}/activity`).then((r) => r.data),
    enabled: Boolean(detailClientId),
  });
  const { data: workerNotes } = useQuery({
    queryKey: ["client-worker-notes", detailClientId],
    queryFn: () => api.get(`/clients/${detailClientId}/worker-notes`).then((r) => r.data),
    enabled: Boolean(detailClientId),
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
      paternal_last_name: c.paternal_last_name ?? "",
      maternal_last_name: c.maternal_last_name ?? "",
      birth_date: c.birth_date ?? "",
      rut: c.rut ?? "",
      address_lat: c.address_lat != null ? String(c.address_lat) : "",
      address_lng: c.address_lng != null ? String(c.address_lng) : "",
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

  function openDetail(clientId: string) {
    setDetailClientId(clientId);
  }

  function closeDetail() {
    setDetailClientId(null);
  }

  function openEditFromDetail() {
    const c = activityData?.client;
    if (!c) return;
    closeDetail();
    openEdit({
      id: c.id,
      name: c.name,
      paternal_last_name: c.paternal_last_name ?? null,
      maternal_last_name: c.maternal_last_name ?? null,
      birth_date: c.birth_date ?? null,
      rut: c.rut ?? null,
      address_lat: c.address_lat ?? null,
      address_lng: c.address_lng ?? null,
      email: c.email,
      phone: c.phone,
      address: c.address ?? null,
      notes: c.notes ?? null,
      created_at: c.created_at ?? "",
      preferences: c.preferences,
    });
  }

  const create = useMutation({
    mutationFn: (d: typeof form) => {
      const { next_contact_date, ...rest } = d;
      const preferences: Record<string, string> = {};
      if (next_contact_date) preferences.next_contact_date = next_contact_date;
      const address_lat = rest.address_lat.trim() ? Number(rest.address_lat) : null;
      const address_lng = rest.address_lng.trim() ? Number(rest.address_lng) : null;
      return api.post("/clients/", { ...rest, address_lat, address_lng, preferences });
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
      const address_lat = rest.address_lat.trim() ? Number(rest.address_lat) : null;
      const address_lng = rest.address_lng.trim() ? Number(rest.address_lng) : null;
      return api.put(`/clients/${editingId}`, { ...rest, address_lat, address_lng, preferences });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      if (editingId) qc.invalidateQueries({ queryKey: ["client-activity", editingId] });
      closeForm();
      toast.success("Cliente actualizado");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.removeQueries({ queryKey: ["client-activity", id] });
      if (detailClientId === id) closeDetail();
      toast.success("Cliente eliminado");
    },
  });
  const addNote = useMutation({
    mutationFn: (clientId: string) => api.post(`/clients/${clientId}/worker-notes`, { note: workerNote }),
    onSuccess: () => {
      setWorkerNote("");
      qc.invalidateQueries({ queryKey: ["client-worker-notes", detailClientId] });
      toast.success("Nota guardada");
    },
    onError: () => toast.error("No se pudo guardar la nota"),
  });

  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (!detailClientId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailClientId]);

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">CRM</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-on-surface">Clientes</h1>
          <p className="mt-1 text-slate-500">{data?.total ?? 0} clientes registrados</p>
          <p className="mt-2 max-w-xl text-sm text-slate-600">
            Alta completa: nombre, apellidos, nacimiento, email y teléfono obligatorios. Tocá una tarjeta para ver el <strong>historial</strong> en la tienda (reservas, compras,
            tickets y reuniones) y el profesional que atendió cada cita — aunque esté desactivado, el nombre se conserva en el registro.
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
              value={form.paternal_last_name}
              onChange={(e) => setForm((f) => ({ ...f, paternal_last_name: e.target.value }))}
              className="input-field"
              placeholder="Apellido paterno *"
            />
            <input
              value={form.maternal_last_name}
              onChange={(e) => setForm((f) => ({ ...f, maternal_last_name: e.target.value }))}
              className="input-field"
              placeholder="Apellido materno *"
            />
            <input
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
              className="input-field"
              placeholder="Fecha nacimiento *"
            />
            <input
              value={form.rut}
              onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))}
              className="input-field"
              placeholder="RUT"
            />
            <input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="input-field"
              placeholder="Email *"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="input-field"
              placeholder="Teléfono *"
            />
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="input-field"
              placeholder="Dirección"
            />
            <input
              value={form.address_lat}
              onChange={(e) => setForm((f) => ({ ...f, address_lat: e.target.value }))}
              className="input-field"
              placeholder="Latitud (punto domicilio)"
            />
            <input
              value={form.address_lng}
              onChange={(e) => setForm((f) => ({ ...f, address_lng: e.target.value }))}
              className="input-field"
              placeholder="Longitud (punto domicilio)"
            />
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">Mapa ({mapProvider === "mapbox" ? "Mapbox" : "Google"})</p>
              <p className="mb-2 text-xs text-slate-500">Usa el mapa para ubicar la vivienda y pega latitud/longitud para registrar la dirección exacta.</p>
              <a
                href={
                  mapProvider === "google"
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapPin || (form.address || "Santiago Chile"))}`
                    : `https://www.mapbox.com/search?query=${encodeURIComponent(mapPin || (form.address || "Santiago Chile"))}`
                }
                target="_blank"
                rel="noreferrer"
                className="btn-ghost mb-2 inline-block text-xs"
              >
                Abrir mapa para marcar punto
              </a>
              {mapProvider === "google" ? (
                <iframe
                  title="mapa-google"
                  className="h-44 w-full rounded-lg border-0"
                  loading="lazy"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(mapPin || (form.address || "Santiago Chile"))}&output=embed`}
                />
              ) : (
                <iframe
                  title="mapa-mapbox"
                  className="h-44 w-full rounded-lg border-0"
                  loading="lazy"
                  src={`https://api.mapbox.com/styles/v1/mapbox/streets-v11.html?title=false&zoomwheel=false#10/-33.45/-70.66`}
                />
              )}
            </div>
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
              disabled={
                !form.name.trim() ||
                !form.paternal_last_name.trim() ||
                !form.maternal_last_name.trim() ||
                !form.birth_date.trim() ||
                !form.email.trim() ||
                !form.phone.trim() ||
                isPending
              }
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
          placeholder="Buscar por nombre, teléfono, RUT o email..."
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.items?.map((client: ClientItem) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            role="button"
            tabIndex={0}
            onClick={() => openDetail(client.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDetail(client.id);
              }
            }}
            className="glass-card-hover cursor-pointer p-5 text-left outline-none ring-primary/40 transition-shadow focus-visible:ring-2"
          >
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
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(client);
                  }}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove.mutate(client.id);
                  }}
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
            <div className="mt-3 flex items-center gap-2">
              {client.phone && (
                <>
                  <a href={`tel:${client.phone}`} className="btn-ghost text-xs">
                    <Phone className="mr-1 inline h-3.5 w-3.5" /> Llamar
                  </a>
                  <a href={`https://wa.me/${client.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn-ghost text-xs">
                    <MessageCircle className="mr-1 inline h-3.5 w-3.5" /> WhatsApp
                  </a>
                </>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} className="btn-ghost text-xs">
                  <Mail className="mr-1 inline h-3.5 w-3.5" /> Email
                </a>
              )}
            </div>
            {typeof client.preferences?.next_contact_date === "string" && client.preferences.next_contact_date && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/5 px-2 py-1.5 text-xs font-medium text-primary">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                Seguimiento: {new Date(`${client.preferences.next_contact_date}T12:00:00`).toLocaleDateString("es-CL", { dateStyle: "long" })}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {detailClientId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
            role="presentation"
            onClick={closeDetail}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="glass-card max-h-[min(90vh,720px)] w-full max-w-lg overflow-hidden shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="client-sheet-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex max-h-[min(90vh,720px)] flex-col">
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/80 p-5">
                  <div className="min-w-0">
                    {activityLoading ? (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Cargando ficha…</span>
                      </div>
                    ) : (
                      <>
                        <h2 id="client-sheet-title" className="truncate text-lg font-bold text-on-surface">
                          {activityData?.client.name ?? "Cliente"}
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Historial en esta tienda · profesionales aunque estén inactivos
                        </p>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={closeDetail}
                    className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Cerrar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  {!activityLoading && activityData && (
                    <>
                      <div className="mb-6 space-y-2 text-sm">
                        {activityData.client.email && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                            {activityData.client.email}
                          </div>
                        )}
                        {activityData.client.phone && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                            {activityData.client.phone}
                          </div>
                        )}
                        {activityData.client.address && (
                          <p className="text-slate-600">{activityData.client.address}</p>
                        )}
                        {activityData.client.notes && (
                          <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">{activityData.client.notes}</p>
                        )}
                        <button type="button" onClick={openEditFromDetail} className="btn-ghost mt-2 text-sm">
                          <Pencil className="mr-1.5 inline h-4 w-4" />
                          Editar datos del cliente
                        </button>
                      </div>

                      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Actividad</p>
                      <div className="mb-4 rounded-xl border border-slate-200 p-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Notas internas</p>
                        <div className="mb-2 space-y-1">
                          {(workerNotes?.items ?? []).slice(0, 5).map((n: { note: string; user: string; at: string }, idx: number) => (
                            <p key={`${n.at}-${idx}`} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
                              {n.note} · {n.user}
                            </p>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input value={workerNote} onChange={(e) => setWorkerNote(e.target.value)} className="input-field h-9 text-sm" placeholder="Agregar nota de atención..." />
                          <button type="button" className="btn-primary text-xs" disabled={!workerNote.trim() || addNote.isPending || !detailClientId} onClick={() => detailClientId && addNote.mutate(detailClientId)}>
                            Guardar
                          </button>
                        </div>
                      </div>
                      {activityData.events.length === 0 ? (
                        <p className="text-sm text-slate-500">Aún no hay reservas, compras ni otros registros vinculados a este cliente.</p>
                      ) : (
                        <ul className="space-y-3">
                          {activityData.events.map((ev) => (
                            <li
                              key={`${ev.kind}-${ev.id}`}
                              className="flex gap-3 rounded-xl border border-slate-200/80 bg-white/60 p-3 text-sm shadow-sm"
                            >
                              {ev.kind === "appointment" && (
                                <>
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                                    <CalendarDays className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-on-surface">{ev.service_name}</p>
                                    <p className="text-slate-600">
                                      {ev.professional_name}
                                      {!ev.professional_is_active && (
                                        <span className="ml-1.5 text-xs font-normal text-amber-700">(inactivo en agenda)</span>
                                      )}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {new Date(ev.start_time).toLocaleString("es-CL", {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                      })}
                                      {ev.branch_name ? ` · ${ev.branch_name}` : ""}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Estado: {APPOINTMENT_STATUS_ES[ev.status] ?? ev.status}
                                      {ev.charged_price_cents != null && ev.charged_price_cents > 0
                                        ? ` · Cobrado: ${formatMoneyCl(ev.charged_price_cents)}`
                                        : ""}
                                    </p>
                                  </div>
                                </>
                              )}
                              {ev.kind === "purchase" && (
                                <>
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                                    <ShoppingBag className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-on-surface">{ev.product_name}</p>
                                    <p className="text-slate-600">
                                      {ev.quantity} × {formatMoneyCl(ev.unit_price)} · Total {formatMoneyCl(ev.total)}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {new Date(ev.at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                                    </p>
                                  </div>
                                </>
                              )}
                              {ev.kind === "ticket" && (
                                <>
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                                    <Kanban className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-on-surface">{ev.title}</p>
                                    <p className="text-slate-600">
                                      {TICKET_TYPE_ES[ev.ticket_type] ?? ev.ticket_type} ·{" "}
                                      {TICKET_STATUS_ES[ev.status] ?? ev.status}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Actualizado{" "}
                                      {new Date(ev.at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                                    </p>
                                  </div>
                                </>
                              )}
                              {ev.kind === "meeting" && (
                                <>
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                                    <Video className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-on-surface">{ev.title}</p>
                                    <p className="text-slate-600">Organiza: {ev.organizer_name}</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {new Date(ev.start_time).toLocaleString("es-CL", {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                      })}
                                    </p>
                                  </div>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
