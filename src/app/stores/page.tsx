"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Building2, Plus, ArrowRight, Settings2, Loader2 } from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { setStoreId, getStoreId } from "@/lib/store";
import clsx from "clsx";

interface StoreTypeItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
}

interface StoreItem {
  id: string;
  name: string;
  slug: string;
  store_type_id: string;
  store_type_name: string | null;
  role: string;
  settings: Record<string, unknown>;
}

export default function StoresPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [configStore, setConfigStore] = useState<StoreItem | null>(null);
  const [businessCtx, setBusinessCtx] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [reminderHours, setReminderHours] = useState(24);
  const [tone, setTone] = useState("professional");

  const { data: types } = useQuery({
    queryKey: ["store-types"],
    queryFn: () => api.get("/store-types/").then((r) => r.data),
  });

  const { data: stores } = useQuery({
    queryKey: ["my-stores"],
    queryFn: () => api.get("/stores/").then((r) => r.data),
  });

  useEffect(() => {
    if (types?.items?.length && !typeId) setTypeId(types.items[0].id);
  }, [types, typeId]);

  useEffect(() => {
    if (!configStore) return;
    const ai = (configStore.settings?.ai as Record<string, string>) || {};
    const ag = (configStore.settings?.agenda as Record<string, number>) || {};
    setBusinessCtx(ai.business_context || "");
    setTone(ai.tone || "professional");
    setDurationMin(ag.default_duration_minutes ?? 30);
    setReminderHours(ag.reminder_hours_before ?? 24);
  }, [configStore]);

  const create = useMutation({
    mutationFn: (body: { name: string; store_type_id: string }) => api.post("/stores/", body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-stores"] });
      setStoreId(res.data.id);
      setName("");
      setShowForm(false);
      toast.success("Tienda creada");
      router.push("/dashboard");
    },
    onError: () => toast.error("No se pudo crear la tienda"),
  });

  const saveConfig = useMutation({
    mutationFn: async () => {
      if (!configStore) return;
      await api.patch(
        `/stores/${configStore.id}`,
        {
          settings: {
            ...configStore.settings,
            ai: { business_context: businessCtx, tone },
            agenda: {
              default_duration_minutes: durationMin,
              reminder_hours_before: Math.max(1, Math.min(168, reminderHours)),
            },
          },
        },
        { headers: { "X-Store-Id": configStore.id } }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-stores"] });
      toast.success("Configuración guardada");
    },
    onError: () => toast.error("Error al guardar"),
  });

  function enterStore(s: StoreItem) {
    setStoreId(s.id);
    toast.success(`Tienda activa: ${s.name}`);
    router.push("/dashboard");
  }

  return (
    <AppLayout>
      <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-2">Tiendas</h1>
          <p className="text-slate-500">Cada tienda tiene su propia agenda, stock, clientes e IA.</p>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 self-start">
          <Plus className="w-4 h-4" /> Nueva tienda
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-8 max-w-xl">
          <h2 className="font-semibold text-on-surface mb-4">Registrar tienda</h2>
          <p className="text-sm text-slate-500 mb-4">Elige el tipo de negocio: se cargará una plantilla de configuración (IA, agenda, stock).</p>
          <div className="space-y-4">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Nombre de la tienda *" />
            <div>
              <label className="text-xs text-slate-500 mb-2 block">Tipo de negocio</label>
              <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="input-field">
                {(types?.items as StoreTypeItem[] | undefined)?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            {typeId && (
              <p className="text-sm text-slate-500">
                {(types?.items as StoreTypeItem[])?.find((x) => x.id === typeId)?.description}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={!name.trim() || !typeId || create.isPending}
                onClick={() => create.mutate({ name: name.trim(), store_type_id: typeId })}
                className="btn-primary"
              >
                {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear tienda"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">
                Cancelar
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
        {(stores?.items as StoreItem[] | undefined)?.map((s) => (
          <motion.div key={s.id} layout className="glass-card-hover p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-on-surface text-lg">{s.name}</h3>
                <p className="text-sm text-slate-500">{s.store_type_name}</p>
                <span className="text-xs text-slate-400 mt-1 inline-block">/{s.slug}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => enterStore(s)} className="btn-primary text-sm py-2 px-4 flex items-center gap-1">
                Entrar <ArrowRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setConfigStore(s)}
                className={clsx(
                  "btn-ghost text-sm py-2 px-4 flex items-center gap-1",
                  configStore?.id === s.id && "ring-1 ring-primary/40"
                )}
              >
                <Settings2 className="w-3 h-3" /> Configuración
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {configStore && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 max-w-2xl">
          <h2 className="font-semibold text-on-surface mb-2 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Configuración: {configStore.name}
          </h2>
          <p className="text-sm text-slate-500 mb-6">Contexto para el asistente IA y valores por defecto de agenda.</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Contexto del negocio (IA)</label>
              <textarea
                value={businessCtx}
                onChange={(e) => setBusinessCtx(e.target.value)}
                className="input-field min-h-[100px]"
                placeholder="Describe servicios, horarios, políticas..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Tono del asistente</label>
                <input value={tone} onChange={(e) => setTone(e.target.value)} className="input-field" placeholder="professional" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Duración reunión por defecto (min)</label>
                <input type="number" min={15} step={5} value={durationMin} onChange={(e) => setDurationMin(+e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Recordatorio de cita (horas antes)</label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={reminderHours}
                  onChange={(e) => setReminderHours(+e.target.value)}
                  className="input-field"
                />
                <p className="text-xs text-slate-500 mt-1">Se envía un correo al cliente (si tiene email) para confirmar o rechazar.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending} className="btn-primary">
                {saveConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
              </button>
              <button type="button" onClick={() => setConfigStore(null)} className="btn-ghost">
                Cerrar
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {stores?.items?.length === 0 && !showForm && (
        <div className="text-center py-16 glass-card">
          <p className="text-slate-500 mb-4">Aún no tienes tiendas. Crea una para comenzar.</p>
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Crear primera tienda
          </button>
        </div>
      )}

      <p className="text-xs text-slate-500 mt-10">
        Tienda activa en esta sesión: {getStoreId() ? <span className="text-slate-600 font-mono">{getStoreId()}</span> : "ninguna"}{" "}
        <Link href="/dashboard" className="text-primary hover:underline ml-2 font-semibold">
          Ir al panel
        </Link>
      </p>
    </AppLayout>
  );
}
