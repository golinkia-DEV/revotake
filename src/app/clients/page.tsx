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
  Sparkles,
  Users,
  FileText,
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
  ];
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem.`;
  if (days < 365) return `hace ${Math.floor(days / 30)} mes.`;
  return `hace ${Math.floor(days / 365)} año(s)`;
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
  const [showAiImport, setShowAiImport] = useState(false);
  const [aiImportText, setAiImportText] = useState("");

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

  const aiImport = useMutation({
    mutationFn: (text: string) => api.post<{ created: number; skipped: number }>("/clients/import-ai", { raw_text: text }).then((r) => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      setShowAiImport(false);
      setAiImportText("");
      toast.success(`Importados ${res.created} clientes${res.skipped > 0 ? `, ${res.skipped} omitidos` : ""}`);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al importar";
      toast.error(msg);
    },
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

  const totalClients: number = data?.total ?? 0;

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">CRM</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {totalClients > 0 ? `${totalClients} clientes registrados` : "Aún no tienes clientes"}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button type="button" onClick={() => setShowAiImport(true)} className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-300 dark:hover:bg-purple-900/50">
            <Sparkles className="h-4 w-4" /> Importar con IA
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Nuevo cliente
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">{editingId ? "Editar cliente" : "Nuevo cliente"}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {editingId ? "Modifica los datos y guarda." : "Completa los datos básicos del cliente."}
              </p>
            </div>
            <button type="button" onClick={closeForm} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Nombre *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Juan" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Apellido paterno *</label>
              <input value={form.paternal_last_name} onChange={(e) => setForm((f) => ({ ...f, paternal_last_name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="González" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Apellido materno *</label>
              <input value={form.maternal_last_name} onChange={(e) => setForm((f) => ({ ...f, maternal_last_name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Pérez" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Fecha de nacimiento *</label>
              <input type="date" value={form.birth_date} onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">RUT</label>
              <input value={form.rut} onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="12.345.678-9" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Email *</label>
              <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="correo@ejemplo.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Teléfono *</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="+56 9 1234 5678" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Dirección</label>
              <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Av. Principal 123, Santiago" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Latitud</label>
              <input value={form.address_lat} onChange={(e) => setForm((f) => ({ ...f, address_lat: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="-33.45" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Longitud</label>
              <input value={form.address_lng} onChange={(e) => setForm((f) => ({ ...f, address_lng: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="-70.66" />
            </div>
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Mapa ({mapProvider === "mapbox" ? "Mapbox" : "Google"})</p>
              <a
                href={
                  mapProvider === "google"
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapPin || (form.address || "Santiago Chile"))}`
                    : `https://www.mapbox.com/search?query=${encodeURIComponent(mapPin || (form.address || "Santiago Chile"))}`
                }
                target="_blank"
                rel="noreferrer"
                className="mb-2 inline-block rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Abrir mapa para marcar punto
              </a>
              {mapProvider === "google" ? (
                <iframe title="mapa-google" className="h-44 w-full rounded-lg border-0" loading="lazy" src={`https://www.google.com/maps?q=${encodeURIComponent(mapPin || (form.address || "Santiago Chile"))}&output=embed`} />
              ) : (
                <iframe title="mapa-mapbox" className="h-44 w-full rounded-lg border-0" loading="lazy" src="https://api.mapbox.com/styles/v1/mapbox/streets-v11.html?title=false&zoomwheel=false#10/-33.45/-70.66" />
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Notas</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white h-20 resize-none" placeholder="Observaciones..." />
            </div>
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                Próximo contacto (opcional)
              </label>
              <input type="date" value={form.next_contact_date} onChange={(e) => setForm((f) => ({ ...f, next_contact_date: e.target.value }))} className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              <p className="mt-1.5 text-xs text-slate-400">Fecha de seguimiento programado.</p>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
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
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Guardar cambios" : "Crear cliente"}
            </button>
            <button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              Cancelar
            </button>
          </div>
        </motion.div>
      )}

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 py-3 pl-12 pr-4 text-sm shadow-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          placeholder="Buscar por nombre, teléfono, RUT o email..."
        />
      </div>

      {/* Empty state */}
      {data?.items?.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-20 text-center dark:border-slate-700"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <Users className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
            {search ? "Sin resultados" : "Aún no tienes clientes"}
          </p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
            {search ? "Prueba con otro nombre, RUT o teléfono" : "Agrega tu primer cliente para comenzar"}
          </p>
          {!search && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-95"
            >
              <Plus className="h-4 w-4" /> Agregar cliente
            </button>
          )}
        </motion.div>
      )}

      {/* Paginación info */}
      {data?.items?.length > 0 && (
        <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
          Mostrando {data.items.length} de {totalClients} clientes
        </p>
      )}

      {/* Grid clientes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.items?.map((client: ClientItem) => {
          const fullName = [client.name, client.paternal_last_name].filter(Boolean).join(" ");
          const avatarBg = getAvatarColor(fullName);
          return (
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
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm outline-none transition-all hover:-translate-y-1 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarBg}`}>
                    {getInitials(fullName)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{fullName}</h3>
                    <p className="text-xs text-slate-400">{timeAgo(client.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openEdit(client); }}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); remove.mutate(client.id); }}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {client.email && (
                <div className="mb-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {client.phone}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {client.phone && (
                  <>
                    <a href={`tel:${client.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                      <Phone className="h-3 w-3" /> Llamar
                    </a>
                    <a href={`https://wa.me/${client.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </a>
                  </>
                )}
                {client.email && (
                  <a href={`mailto:${client.email}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                    <Mail className="h-3 w-3" /> Email
                  </a>
                )}
              </div>
              {typeof client.preferences?.next_contact_date === "string" && client.preferences.next_contact_date && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  Seguimiento: {new Date(`${client.preferences.next_contact_date}T12:00:00`).toLocaleDateString("es-CL", { dateStyle: "long" })}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Detail drawer */}
      <AnimatePresence>
        {detailClientId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm sm:items-center"
            role="presentation"
            onClick={closeDetail}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
              role="dialog"
              aria-modal="true"
              aria-labelledby="client-sheet-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex max-h-[min(90vh,720px)] flex-col">
                {/* Header */}
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-700">
                  <div className="min-w-0">
                    {activityLoading ? (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Cargando ficha...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          {activityData?.client.name && (
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${getAvatarColor(activityData.client.name)}`}>
                              {getInitials(activityData.client.name)}
                            </div>
                          )}
                          <div>
                            <h2 id="client-sheet-title" className="truncate text-lg font-bold text-slate-900 dark:text-white">
                              {activityData?.client.name ?? "Cliente"}
                            </h2>
                            <p className="text-xs text-slate-500">Historial en esta tienda</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={closeDetail}
                    className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                    aria-label="Cerrar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  {!activityLoading && activityData && (
                    <>
                      {/* Contact info */}
                      <div className="mb-5 space-y-2 text-sm">
                        {activityData.client.email && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                            {activityData.client.email}
                          </div>
                        )}
                        {activityData.client.phone && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                            {activityData.client.phone}
                          </div>
                        )}
                        {activityData.client.address && (
                          <p className="text-slate-600 dark:text-slate-400">{activityData.client.address}</p>
                        )}
                        {activityData.client.notes && (
                          <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{activityData.client.notes}</p>
                        )}
                        <button type="button" onClick={openEditFromDetail} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                          <Pencil className="h-3.5 w-3.5" />
                          Editar datos del cliente
                        </button>
                      </div>

                      {/* Notas internas */}
                      <div className="mb-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Notas internas</p>
                        <div className="mb-3 space-y-1.5">
                          {(workerNotes?.items ?? []).slice(0, 5).map((n: { note: string; user: string; at: string }, idx: number) => (
                            <p key={`${n.at}-${idx}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {n.note} <span className="text-slate-400">· {n.user}</span>
                            </p>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input value={workerNote} onChange={(e) => setWorkerNote(e.target.value)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Agregar nota..." />
                          <button type="button" className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50" disabled={!workerNote.trim() || addNote.isPending || !detailClientId} onClick={() => detailClientId && addNote.mutate(detailClientId)}>
                            Guardar
                          </button>
                        </div>
                      </div>

                      {/* Actividad */}
                      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Actividad</p>
                      {(activityData.events ?? []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700">
                          <User className="mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm text-slate-500">Sin reservas, compras ni registros aún</p>
                        </div>
                      ) : (
                        <ul className="space-y-3">
                          {(activityData.events ?? []).map((ev) => (
                            <li
                              key={`${ev.kind}-${ev.id}`}
                              className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
                            >
                              {ev.kind === "appointment" && (
                                <>
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                                    <CalendarDays className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-900 dark:text-white">{ev.service_name}</p>
                                    <p className="text-slate-600 dark:text-slate-400">
                                      {ev.professional_name}
                                      {!ev.professional_is_active && (
                                        <span className="ml-1.5 text-xs font-normal text-amber-700 dark:text-amber-400">(inactivo)</span>
                                      )}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                      {new Date(ev.start_time).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                                      {ev.branch_name ? ` · ${ev.branch_name}` : ""}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-400">
                                      {APPOINTMENT_STATUS_ES[ev.status] ?? ev.status}
                                      {ev.charged_price_cents != null && ev.charged_price_cents > 0
                                        ? ` · ${formatMoneyCl(ev.charged_price_cents)}`
                                        : ""}
                                    </p>
                                  </div>
                                </>
                              )}
                              {ev.kind === "purchase" && (
                                <>
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    <ShoppingBag className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-900 dark:text-white">{ev.product_name}</p>
                                    <p className="text-slate-600 dark:text-slate-400">
                                      {ev.quantity} × {formatMoneyCl(ev.unit_price)} · Total {formatMoneyCl(ev.total)}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                      {new Date(ev.at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                                    </p>
                                  </div>
                                </>
                              )}
                              {ev.kind === "ticket" && (
                                <>
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                                    <Kanban className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-900 dark:text-white">{ev.title}</p>
                                    <p className="text-slate-600 dark:text-slate-400">
                                      {TICKET_TYPE_ES[ev.ticket_type] ?? ev.ticket_type} · {TICKET_STATUS_ES[ev.status] ?? ev.status}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                      {new Date(ev.at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                                    </p>
                                  </div>
                                </>
                              )}
                              {ev.kind === "meeting" && (
                                <>
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                    <Video className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-900 dark:text-white">{ev.title}</p>
                                    <p className="text-slate-600 dark:text-slate-400">Organiza: {ev.organizer_name}</p>
                                    <p className="mt-1 text-xs text-slate-400">
                                      {new Date(ev.start_time).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
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

      {/* AI Import Modal */}
      <AnimatePresence>
        {showAiImport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowAiImport(false); setAiImportText(""); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                    <Sparkles className="h-5 w-5 text-purple-600" /> Importar clientes con IA
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">Pega texto desde Excel, CSV o una lista. La IA detectará los datos automáticamente.</p>
                </div>
                <button type="button" onClick={() => { setShowAiImport(false); setAiImportText(""); }} className="ml-3 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-700 dark:border-purple-900/40 dark:bg-purple-950/20 dark:text-purple-300">
                <FileText className="h-4 w-4 shrink-0" />
                <span>Ejemplo: copia celdas desde Excel con columnas nombre, email, teléfono, dirección, etc.</span>
              </div>
              <textarea
                value={aiImportText}
                onChange={(e) => setAiImportText(e.target.value)}
                rows={8}
                placeholder={"Nombre\tEmail\tTeléfono\nJuana García\tjuana@mail.com\t+56 9 1234 5678\nPedro López\tpedro@mail.com\t"}
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => { setShowAiImport(false); setAiImportText(""); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!aiImportText.trim() || aiImport.isPending}
                  onClick={() => aiImport.mutate(aiImportText)}
                  className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {aiImport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {aiImport.isPending ? "Procesando…" : "Importar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
