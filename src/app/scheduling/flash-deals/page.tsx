"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Zap,
  Clock,
  Percent,
  User,
  Scissors,
  CheckCircle2,
  XCircle,
  Plus,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";

// ── Types ──────────────────────────────────────────────────────────────────────

type Branch = { id: string; name: string; slug: string };
type Professional = { id: string; name: string };
type Service = { id: string; name: string; duration_minutes: number; price_cents: number; currency: string };

type FlashDeal = {
  id: string;
  branch_id: string;
  professional_id: string;
  service_id: string;
  discount_percent: number;
  original_price_cents: number;
  discounted_price_cents: number;
  slot_start_time: string;
  slot_end_time: string;
  title: string;
  description: string | null;
  expires_at: string;
  is_active: boolean;
  is_claimed: boolean;
  claimed_at: string | null;
  created_at: string;
  professional_name: string | null;
  service_name: string | null;
  branch_name: string | null;
};

type FlashDealStats = {
  total_active: number;
  total_claimed: number;
  total_expired: number;
  revenue_lost_to_deals_cents: number;
};

// ── Helpers ─────────────────────────────────────────────────────────────────────

function fmtCLP(cents: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

function fmtDatetime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `hace ${d}d`;
  if (h > 0) return `hace ${h}h`;
  if (m > 0) return `hace ${m}m`;
  return "ahora";
}

function dealStatus(deal: FlashDeal): { label: string; color: "emerald" | "blue" | "slate" | "amber" } {
  const now = new Date();
  const expires = new Date(deal.expires_at);
  if (deal.is_claimed) return { label: "RECLAMADA", color: "blue" };
  if (!deal.is_active) return { label: "CANCELADA", color: "slate" };
  if (expires <= now) return { label: "VENCIDA", color: "slate" };
  return { label: "ACTIVA", color: "emerald" };
}

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

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function calc() {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Vencida"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    }
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 dark:bg-amber-900/20">
      <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
      <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">{remaining}</span>
    </div>
  );
}

// ── Modal Crear Oferta ───────────────────────────────────────────────────────────

function CreateDealModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [branchId, setBranchId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [discountPercent, setDiscountPercent] = useState(20);
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: branchesData } = useQuery<{ items: Branch[] }>({
    queryKey: ["branches-list"],
    queryFn: () => api.get("/scheduling/branches").then((r) => r.data),
  });
  const branches = branchesData?.items ?? [];

  const { data: profsData } = useQuery<{ items: Professional[] }>({
    queryKey: ["professionals-by-branch", branchId, serviceId],
    queryFn: () =>
      api.get(`/scheduling/professionals`, { params: { branch_id: branchId, service_id: serviceId } }).then((r) => r.data),
    enabled: !!branchId && !!serviceId,
  });
  const professionals = profsData?.items ?? [];

  const { data: svcsData } = useQuery<{ items: Service[] }>({
    queryKey: ["services-active"],
    queryFn: () => api.get("/scheduling/services").then((r) => r.data),
  });
  const services = svcsData?.items ?? [];

  const selectedService = services.find((s) => s.id === serviceId);

  useEffect(() => {
    if (selectedService && discountPercent) {
      setTitle(`¡${discountPercent}% OFF en ${selectedService.name} hoy!`);
    }
  }, [selectedService, discountPercent]);

  useEffect(() => {
    if (slotDate && slotTime) {
      const slotDt = new Date(`${slotDate}T${slotTime}`);
      slotDt.setHours(slotDt.getHours() - 2);
      const pad = (n: number) => String(n).padStart(2, "0");
      const y = slotDt.getFullYear();
      const mo = pad(slotDt.getMonth() + 1);
      const d = pad(slotDt.getDate());
      const h = pad(slotDt.getHours());
      const mi = pad(slotDt.getMinutes());
      setExpiresAt(`${y}-${mo}-${d}T${h}:${mi}`);
    }
  }, [slotDate, slotTime]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post("/scheduling/flash-deals", payload).then((r) => r.data),
    onSuccess: () => {
      toast.success("Oferta flash creada");
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al crear oferta";
      toast.error(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId || !professionalId || !serviceId || !slotDate || !slotTime || !title || !expiresAt) {
      toast.error("Completa todos los campos requeridos");
      return;
    }
    mutation.mutate({
      branch_id: branchId,
      professional_id: professionalId,
      service_id: serviceId,
      discount_percent: discountPercent,
      slot_start_time: `${slotDate}T${slotTime}:00`,
      title,
      description: description || null,
      expires_at: `${expiresAt}:00`,
    });
  }

  const originalPrice = selectedService?.price_cents ?? 0;
  const discountedPrice = Math.max(0, originalPrice - Math.round((originalPrice * discountPercent) / 100));

  const inputCls = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-800 dark:text-white";
  const labelCls = "block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Nueva Oferta Flash</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Datos básicos */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Datos básicos</p>
            <div>
              <label className={labelCls}>Sucursal</label>
              <select
                value={branchId}
                onChange={(e) => { setBranchId(e.target.value); setProfessionalId(""); }}
                required
                className={inputCls}
              >
                <option value="">Seleccionar sucursal...</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Servicio</label>
              <select
                value={serviceId}
                onChange={(e) => { setServiceId(e.target.value); setProfessionalId(""); }}
                required
                className={inputCls}
              >
                <option value="">Seleccionar servicio...</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Profesional</label>
              <select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                required
                disabled={!branchId || !serviceId}
                className={`${inputCls} disabled:opacity-50`}
              >
                <option value="">
                  {!branchId || !serviceId ? "Selecciona sucursal y servicio primero" : "Seleccionar profesional..."}
                </option>
                {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Horario */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Horario del slot</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fecha</label>
                <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} required min={new Date().toISOString().split("T")[0]} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Hora</label>
                <input type="time" value={slotTime} onChange={(e) => setSlotTime(e.target.value)} required step={900} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Vence a las</label>
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} required className={inputCls} />
              <p className="mt-1 text-xs text-slate-400">Debe ser antes del horario del slot.</p>
            </div>
          </div>

          {/* Descuento */}
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 space-y-3 dark:border-amber-900/30 dark:bg-amber-900/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Descuento</p>
            <div>
              <label className={labelCls}>
                Descuento: <span className="font-bold text-amber-600">{discountPercent}%</span>
              </label>
              <input type="range" min={1} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} className="w-full accent-amber-500" />
              <div className="flex justify-between text-xs text-slate-400 mt-1"><span>1%</span><span>50%</span><span>100%</span></div>
            </div>

            {/* Preview de precio */}
            {selectedService && (
              <div className="flex items-center gap-3 rounded-xl bg-white border border-amber-200 px-4 py-3 dark:bg-slate-900 dark:border-amber-800">
                <span className="text-sm text-slate-400 line-through">{fmtCLP(originalPrice)}</span>
                <span className="text-2xl font-bold text-emerald-600">{fmtCLP(discountedPrice)}</span>
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">-{discountPercent}%</span>
              </div>
            )}
          </div>

          {/* Texto de la oferta */}
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Título de la oferta</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder="¡20% OFF en corte hoy!" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Descripción (opcional)</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Slot disponible hoy a las 15:00..." className={inputCls} />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60 active:scale-95 transition-all">
              <Zap className="h-4 w-4" />
              {mutation.isPending ? "Creando..." : "Publicar oferta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Deal Card ────────────────────────────────────────────────────────────────────

function DealCard({ deal, onCancel }: { deal: FlashDeal; onCancel: (id: string) => void }) {
  const status = dealStatus(deal);
  const isActive = deal.is_active && !deal.is_claimed && new Date(deal.expires_at) > new Date();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {isActive && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <Badge color="emerald">ACTIVA</Badge>
            </span>
          )}
          {!isActive && <Badge color={status.color}>{status.label}</Badge>}
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            <Percent className="h-3 w-3" />
            -{deal.discount_percent}%
          </span>
        </div>
        {isActive && (
          <button
            onClick={() => onCancel(deal.id)}
            className="flex items-center gap-1 rounded-xl border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancelar
          </button>
        )}
      </div>

      <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">{deal.title}</h3>
      {deal.description && <p className="mb-3 text-xs text-slate-500">{deal.description}</p>}

      <div className="space-y-1.5 text-sm">
        {deal.professional_name && (
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>{deal.professional_name}</span>
          </div>
        )}
        {deal.service_name && (
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Scissors className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>{deal.service_name}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>{fmtDatetime(deal.slot_start_time)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 line-through">{fmtCLP(deal.original_price_cents)}</span>
          <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">{fmtCLP(deal.discounted_price_cents)}</span>
        </div>
        {isActive && <Countdown expiresAt={deal.expires_at} />}
        {deal.is_claimed && deal.claimed_at && (
          <div className="flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-slate-500">Reclamada {relTime(deal.claimed_at)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────────

export default function FlashDealsPage() {
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: deals = [], isLoading } = useQuery<FlashDeal[]>({
    queryKey: ["flash-deals"],
    queryFn: () => api.get("/scheduling/flash-deals").then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery<FlashDealStats>({
    queryKey: ["flash-deals-stats"],
    queryFn: () => api.get("/scheduling/flash-deals/stats").then((r) => r.data),
    refetchInterval: 30_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (dealId: string) => api.put(`/scheduling/flash-deals/${dealId}/cancel`).then((r) => r.data),
    onSuccess: () => {
      toast.success("Oferta cancelada");
      queryClient.invalidateQueries({ queryKey: ["flash-deals"] });
      queryClient.invalidateQueries({ queryKey: ["flash-deals-stats"] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al cancelar";
      toast.error(msg);
    },
  });

  function handleInvalidate() {
    queryClient.invalidateQueries({ queryKey: ["flash-deals"] });
    queryClient.invalidateQueries({ queryKey: ["flash-deals-stats"] });
  }

  const activeDeals = deals.filter((d) => d.is_active && !d.is_claimed && new Date(d.expires_at) > new Date());
  const historyDeals = deals.filter((d) => d.is_claimed || !d.is_active || new Date(d.expires_at) <= new Date());

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
              <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ofertas Flash</h1>
              <p className="text-sm text-slate-500">Llena slots libres con descuentos en tiempo real</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-600 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            Nueva Oferta
          </button>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Activas</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.total_active}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Reclamadas</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.total_claimed}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Vencidas</p>
              <p className="text-2xl font-bold text-slate-500">{stats.total_expired}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Ahorro generado</p>
              <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{fmtCLP(stats.revenue_lost_to_deals_cents)}</p>
            </div>
          </div>
        )}

        {/* Ofertas activas */}
        <section className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-200">
            <Zap className="h-4 w-4 text-amber-500" />
            Ofertas activas
          </h2>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
            </div>
          ) : activeDeals.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
              <Zap className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">Sin ofertas activas</p>
              <p className="mt-1 text-sm text-slate-400">Crea una oferta flash para llenar un horario libre rápidamente</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
                Crear primera oferta
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {activeDeals.map((d) => (
                <DealCard key={d.id} deal={d} onCancel={(id) => cancelMutation.mutate(id)} />
              ))}
            </div>
          )}
        </section>

        {/* Historial */}
        {historyDeals.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-200">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              Historial
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {historyDeals.map((d) => (
                <DealCard key={d.id} deal={d} onCancel={(id) => cancelMutation.mutate(id)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {showModal && (
        <CreateDealModal onClose={() => setShowModal(false)} onSuccess={handleInvalidate} />
      )}
    </AppLayout>
  );
}
