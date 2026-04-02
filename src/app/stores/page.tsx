"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Building2,
  Plus,
  ArrowRight,
  Settings2,
  Loader2,
  LayoutGrid,
  Sparkles,
  ChevronRight,
  Info,
  Users,
  FileSpreadsheet,
  ImageIcon,
} from "lucide-react";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { setStoreId, getStoreId } from "@/lib/store";
import clsx from "clsx";
import { WORKFLOW_PRESETS, WIZARD_HELP_TEXT, type WorkflowPresetId, presetById } from "@/lib/operationsWorkflow";
import {
  emptyStoreProfile,
  listSelectedAmenityLabels,
  mergeStoreProfileFromApi,
  type StoreProfile,
} from "@/lib/storeProfile";
import { FiscalChileStep, LocationAndHoursStep, AmenitiesStep } from "@/components/store/StoreProfileWizardSections";
import { fileUrl } from "@/lib/files";

interface StoreTypeItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  default_settings?: Record<string, unknown>;
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

// ── Selector de tipo de negocio ────────────────────────────────────────────
function StoreTypeSelector({
  types,
  selected,
  onSelect,
}: {
  types: StoreTypeItem[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = types.filter((t) =>
    t.name.toLowerCase().includes(q.toLowerCase()) ||
    (t.description ?? "").toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="space-y-2">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar tipo de negocio..."
          className="input-field pl-9 text-sm"
        />
      </div>
      <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3">
        {filtered.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-all ${
              selected === t.id
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : "border-slate-200 hover:border-primary/40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            }`}
          >
            <span className="block font-medium leading-tight">{t.name}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-3 py-4 text-center text-sm text-slate-400">Sin resultados</p>
        )}
      </div>
    </div>
  );
}

export default function StoresPage() {
  const canCreateStores = getUser()?.role === "admin";
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [workflowPreset, setWorkflowPreset] = useState<WorkflowPresetId>("sales");
  const [workflowNotes, setWorkflowNotes] = useState("");
  const [configStore, setConfigStore] = useState<StoreItem | null>(null);
  const [businessCtx, setBusinessCtx] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [reminderHours, setReminderHours] = useState(24);
  const [chairCount, setChairCount] = useState(4);
  const [roomCount, setRoomCount] = useState(1);
  const [tone, setTone] = useState("professional");
  const [configWorkflowPreset, setConfigWorkflowPreset] = useState<WorkflowPresetId>("generic");
  const [configWorkflowNotes, setConfigWorkflowNotes] = useState("");
  const [configChairCount, setConfigChairCount] = useState(0);
  const [configRoomCount, setConfigRoomCount] = useState(0);
  const [platformMapProvider, setPlatformMapProvider] = useState<"google" | "mapbox">("google");
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(() => emptyStoreProfile());
  const [profileConfig, setProfileConfig] = useState<StoreProfile>(() => emptyStoreProfile());
  /** Paso de listado de clientes: omitir o pegar texto / CSV para IA */
  const [clientImportMode, setClientImportMode] = useState<"skip" | "paste">("skip");
  const [clientImportText, setClientImportText] = useState("");
  const wizardStep6Prefilled = useRef(false);

  const { data: types } = useQuery({
    queryKey: ["store-types"],
    queryFn: () => api.get("/store-types/").then((r) => r.data),
    enabled: canCreateStores,
  });

  const { data: stores } = useQuery({
    queryKey: ["my-stores"],
    queryFn: () => api.get("/stores/").then((r) => r.data),
  });

  useEffect(() => {
    if (types?.items?.length && !typeId) setTypeId(types.items[0].id);
  }, [types, typeId]);

  useEffect(() => {
    if (showForm) wizardStep6Prefilled.current = false;
  }, [showForm]);

  useEffect(() => {
    if (wizardStep !== 6 || wizardStep6Prefilled.current || !typeId || !types?.items) return;
    wizardStep6Prefilled.current = true;
    const t = (types.items as StoreTypeItem[]).find((x) => x.id === typeId);
    const def = t?.default_settings;
    if (!def) return;
    const ai = (def.ai as Record<string, string>) || {};
    const ag = (def.agenda as Record<string, number>) || {};
    if (ai.business_context) setBusinessCtx(ai.business_context);
    if (ai.tone) setTone(ai.tone);
    if (ag.default_duration_minutes != null) setDurationMin(ag.default_duration_minutes);
    if (ag.reminder_hours_before != null) setReminderHours(ag.reminder_hours_before);
  }, [wizardStep, typeId, types]);

  useEffect(() => {
    if (!configStore) return;
    const ai = (configStore.settings?.ai as Record<string, string>) || {};
    const ag = (configStore.settings?.agenda as Record<string, number>) || {};
    const op = (configStore.settings?.operations as Record<string, unknown>) || {};
    setBusinessCtx(ai.business_context || "");
    setTone(ai.tone || "professional");
    setDurationMin(ag.default_duration_minutes ?? 30);
    setReminderHours(ag.reminder_hours_before ?? 24);
    const p = op.preset as WorkflowPresetId | undefined;
    setConfigWorkflowPreset(p && WORKFLOW_PRESETS.some((x) => x.id === p) ? p : "generic");
    setConfigWorkflowNotes(typeof op.workflow_notes === "string" ? op.workflow_notes : "");
    const loc = (configStore.settings?.local_structure as Record<string, unknown>) || {};
    setConfigChairCount(typeof loc.chair_count === "number" ? loc.chair_count : Number(loc.chair_count) || 0);
    setConfigRoomCount(typeof loc.room_count === "number" ? loc.room_count : Number(loc.room_count) || 0);
    setProfileConfig(mergeStoreProfileFromApi(configStore.settings?.store_profile));
    const platformCfg = (configStore.settings?.platform as Record<string, string>) || {};
    setPlatformMapProvider(platformCfg.map_provider === "mapbox" ? "mapbox" : "google");
  }, [configStore]);

  const create = useMutation({
    mutationFn: async () => {
      const typeDefaults = (types?.items as StoreTypeItem[] | undefined)?.find((t) => t.id === typeId)?.default_settings || {};
      const aiBase = (typeDefaults.ai as Record<string, string>) || {};
      const agendaBase = (typeDefaults.agenda as Record<string, number>) || {};
      const settings_override = {
        store_profile: storeProfile,
        operations: {
          preset: workflowPreset,
          workflow_notes: workflowNotes.trim(),
          wizard_version: 2,
        },
        ai: { ...aiBase, business_context: businessCtx, tone },
        agenda: {
          ...agendaBase,
          default_duration_minutes: durationMin,
          reminder_hours_before: Math.max(1, Math.min(168, reminderHours)),
        },
        local_structure: {
          chair_count: Math.max(0, Math.min(200, chairCount)),
          room_count: Math.max(0, Math.min(100, roomCount)),
        },
      };
      const res = await api.post("/stores/", { name: name.trim(), store_type_id: typeId, settings_override });
      const newId = res.data.id as string;
      setStoreId(newId);

      let imported = 0;
      let importError: string | null = null;
      const raw = clientImportMode === "paste" ? clientImportText.trim() : "";
      if (raw.length > 0) {
        try {
          const ir = await api.post<{ created: number }>(
            "/clients/import-ai",
            { raw_text: raw.slice(0, 400_000) },
            { headers: { "X-Store-Id": newId } }
          );
          imported = typeof ir.data?.created === "number" ? ir.data.created : 0;
        } catch (e: unknown) {
          const d = axios.isAxiosError(e) ? e.response?.data?.detail : null;
          importError =
            typeof d === "string" ? d : d != null ? JSON.stringify(d) : e instanceof Error ? e.message : "Error al importar con IA";
        }
      }
      return { imported, importError };
    },
    onSuccess: ({ imported, importError }) => {
      qc.invalidateQueries({ queryKey: ["my-stores"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setName("");
      setWorkflowNotes("");
      setWizardStep(1);
      setStoreProfile(emptyStoreProfile());
      setClientImportMode("skip");
      setClientImportText("");
      setShowForm(false);
      toast.success(
        imported > 0
          ? `Tienda creada. La IA organizó e importó ${imported} perfil${imported === 1 ? "" : "es"} de cliente.`
          : "Tienda creada"
      );
      if (importError) {
        toast.error(`La tienda quedó creada, pero la importación de clientes falló: ${importError}`);
      }
      router.push("/onboarding");
    },
    onError: (e: unknown) => {
      const d = axios.isAxiosError(e) ? e.response?.data?.detail : null;
      const msg =
        typeof d === "string" ? d : d != null ? JSON.stringify(d) : "No se pudo crear la tienda";
      toast.error(
        e && axios.isAxiosError(e) && e.response?.status === 403
          ? "Solo un administrador de la plataforma puede crear tiendas nuevas."
          : msg
      );
    },
  });

  const saveConfig = useMutation({
    mutationFn: async () => {
      if (!configStore) return;
      await api.patch(
        `/stores/${configStore.id}`,
        {
          settings: {
            ...configStore.settings,
            store_profile: profileConfig,
            operations: {
              ...((configStore.settings?.operations as object) || {}),
              preset: configWorkflowPreset,
              workflow_notes: configWorkflowNotes.trim(),
            },
            ai: { ...((configStore.settings?.ai as Record<string, string>) || {}), business_context: businessCtx, tone },
            agenda: {
              ...((configStore.settings?.agenda as Record<string, number>) || {}),
              default_duration_minutes: durationMin,
              reminder_hours_before: Math.max(1, Math.min(168, reminderHours)),
            },
            local_structure: {
              chair_count: Math.max(0, Math.min(200, configChairCount)),
              room_count: Math.max(0, Math.min(100, configRoomCount)),
            },
            platform: {
              ...((configStore.settings?.platform as Record<string, string>) || {}),
              map_provider: platformMapProvider,
            },
          },
        },
        { headers: { "X-Store-Id": configStore.id } }
      );
      if (canCreateStores) {
        await api.patch("/stores/platform/map-provider", { map_provider: platformMapProvider });
      }
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
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-on-surface mb-2">Tiendas</h1>
          <p className="text-slate-500">
            Enfocado en belleza, salud y citas: estética, peluquería, barbería, spa, clínicas, gimnasio y más. Cada local
            tiene su agenda, menú de servicios con fotos, logotipo en reservas y asistente IA.
          </p>
        </div>
        {canCreateStores ? (
          <button
            type="button"
            onClick={() => {
              setShowForm(!showForm);
              if (!showForm) {
                setWizardStep(1);
                setWorkflowNotes("");
                setName("");
                setWorkflowPreset("sales");
                setBusinessCtx("");
                setTone("professional");
                setDurationMin(30);
                setReminderHours(24);
                setChairCount(4);
                setRoomCount(1);
                setStoreProfile(emptyStoreProfile());
                setClientImportMode("skip");
                setClientImportText("");
              }
            }}
            className="btn-primary flex items-center gap-2 self-start"
          >
            <Plus className="w-4 h-4" /> Nueva tienda
          </button>
        ) : null}
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="glass-card mb-8 max-w-3xl p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-on-surface flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Asistente: nueva tienda
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Paso {wizardStep} de 8 · Incluye importación opcional de clientes con IA (Excel o pegado).
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <span
                  key={s}
                  className={clsx(
                    "h-2 w-8 rounded-full transition-colors",
                    wizardStep >= s ? "bg-primary" : "bg-slate-200"
                  )}
                />
              ))}
            </div>
          </div>

          {wizardStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Nombre del local y rubro (estética, barbería, spa, salud, deporte…). La plantilla ajusta IA y duración típica
                de cita.
              </p>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Nombre de la tienda *" />
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-500">Tipo de negocio</label>
                {/* Buscador */}
                <StoreTypeSelector
                  types={(types?.items as StoreTypeItem[] | undefined) ?? []}
                  selected={typeId}
                  onSelect={setTypeId}
                />
              </div>
              {typeId && (
                <p className="text-sm text-slate-500">
                  {(types?.items as StoreTypeItem[])?.find((x) => x.id === typeId)?.description}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={!name.trim() || !typeId}
                  onClick={() => setWizardStep(2)}
                  className="btn-primary inline-flex items-center gap-1"
                >
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              <FiscalChileStep value={storeProfile.fiscal_chile} onChange={(f) => setStoreProfile((p) => ({ ...p, fiscal_chile: f }))} />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setWizardStep(1)} className="btn-ghost">
                  Atrás
                </button>
                <button type="button" onClick={() => setWizardStep(3)} className="btn-primary inline-flex items-center gap-1">
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              <LocationAndHoursStep
                location={storeProfile.location_public}
                horarios={storeProfile.horarios}
                onLocation={(location_public) => setStoreProfile((p) => ({ ...p, location_public }))}
                onHorarios={(horarios) => setStoreProfile((p) => ({ ...p, horarios }))}
              />
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="mb-2 text-xs font-medium text-slate-600">
                  Mapa de ubicación ({platformMapProvider === "mapbox" ? "Mapbox" : "Google"})
                </p>
                {platformMapProvider === "google" ? (
                  <iframe
                    title="store-map-google"
                    className="h-48 w-full rounded-lg border-0"
                    loading="lazy"
                    src={`https://www.google.com/maps?q=${encodeURIComponent(
                      `${storeProfile.location_public.direccion_atencion} ${storeProfile.location_public.comuna} Chile`
                    )}&output=embed`}
                  />
                ) : (
                  <iframe
                    title="store-map-mapbox"
                    className="h-48 w-full rounded-lg border-0"
                    loading="lazy"
                    src="https://api.mapbox.com/styles/v1/mapbox/streets-v11.html?title=false&zoomwheel=false#10/-33.45/-70.66"
                  />
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setWizardStep(2)} className="btn-ghost">
                  Atrás
                </button>
                <button type="button" onClick={() => setWizardStep(4)} className="btn-primary inline-flex items-center gap-1">
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="space-y-4">
              <AmenitiesStep value={storeProfile.amenities} onChange={(amenities) => setStoreProfile((p) => ({ ...p, amenities }))} />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setWizardStep(3)} className="btn-ghost">
                  Atrás
                </button>
                <button type="button" onClick={() => setWizardStep(5)} className="btn-primary inline-flex items-center gap-1">
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {wizardStep === 5 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-primary" />
                  Operaciones (tablero de tickets)
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Cada tienda puede usar el mismo tablero con <strong>etiquetas distintas</strong>: elige la plantilla que mejor describa cómo se mueven tus
                  solicitudes. Luego podrás ajustarlo en Configuración.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {WORKFLOW_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setWorkflowPreset(p.id)}
                    className={clsx(
                      "rounded-2xl border p-4 text-left transition-all",
                      workflowPreset === p.id ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <span className="font-semibold text-on-surface">{p.title}</span>
                    <p className="mt-1 text-xs text-slate-600">{p.description}</p>
                  </button>
                ))}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">¿Cómo es tu flujo en una frase? (opcional)</label>
                <textarea
                  value={workflowNotes}
                  onChange={(e) => setWorkflowNotes(e.target.value)}
                  className="input-field min-h-[80px]"
                  placeholder="Ej.: Primero tomamos el dato por WhatsApp, luego agendamos visita y cerramos con presupuesto."
                />
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{WIZARD_HELP_TEXT.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{WIZARD_HELP_TEXT.body}</p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setWizardStep(4)} className="btn-ghost">
                  Atrás
                </button>
                <button type="button" onClick={() => setWizardStep(6)} className="btn-primary inline-flex items-center gap-1">
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {wizardStep === 6 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Ajustes rápidos de <strong>agenda</strong> y <strong>asistente IA</strong>. Podrás cambiarlos después en Configuración de la tienda.
              </p>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Contexto del negocio para la IA</label>
                <textarea
                  value={businessCtx}
                  onChange={(e) => setBusinessCtx(e.target.value)}
                  className="input-field min-h-[90px]"
                  placeholder="Ej.: Horario, servicios, políticas de cancelación…"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Tono del asistente</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className="input-field">
                    <option value="professional">Profesional</option>
                    <option value="friendly">Cercano</option>
                    <option value="brief">Breve y directo</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Duración típica de reunión / cita (minutos)</label>
                  <input
                    type="number"
                    min={15}
                    step={5}
                    value={durationMin}
                    onChange={(e) => setDurationMin(+e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-slate-500">Recordatorio de cita (horas antes)</label>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={reminderHours}
                    onChange={(e) => setReminderHours(+e.target.value)}
                    className="input-field max-w-xs"
                  />
                  <p className="mt-1 text-xs text-slate-500">Se usa para avisar al cliente por correo cuando aplique.</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-sm font-semibold text-on-surface">Sillones y salas del local</p>
                <p className="mt-1 text-xs text-slate-600">
                  Definí cuántos <strong>sillones</strong> y <strong>salas</strong> tiene tu primer local. Al crear la primera sede en Citas, se generarán
                  automáticamente con nombres tipo «Sillón 1» y «Sala 1». Podés editarlos o agregar más en{" "}
                  <strong>Sedes y equipo</strong>.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs text-slate-500">Cantidad de sillones / puestos</span>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={chairCount}
                      onChange={(e) => setChairCount(Math.max(0, Math.min(200, +e.target.value || 0)))}
                      className="input-field"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs text-slate-500">Cantidad de salas / cabinas</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={roomCount}
                      onChange={(e) => setRoomCount(Math.max(0, Math.min(100, +e.target.value || 0)))}
                      className="input-field"
                    />
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setWizardStep(5)} className="btn-ghost">
                  Atrás
                </button>
                <button type="button" onClick={() => setWizardStep(7)} className="btn-primary inline-flex items-center gap-1">
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {wizardStep === 7 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 p-4">
                <p className="text-sm font-semibold text-violet-950 flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-600" />
                  ¿Tienes ya un listado de clientes?
                </p>
                <p className="mt-2 text-sm text-violet-900/85">
                  Podés pegar una tabla copiada desde <strong>Excel</strong> (Ctrl+C en las celdas), un <strong>CSV</strong> exportado o cualquier listado con
                  columnas. La <strong>IA</strong> interpreta encabezados y filas, arma nombre, correo, teléfono, dirección, notas y guarda el resto en{" "}
                  <strong>campos personalizados</strong> del perfil de cada cliente.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setClientImportMode("skip");
                    setClientImportText("");
                  }}
                  className={clsx(
                    "rounded-2xl border p-4 text-left transition-all",
                    clientImportMode === "skip" ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <span className="font-semibold text-on-surface">No, después los agrego</span>
                  <p className="mt-1 text-xs text-slate-600">Seguís al resumen y creás la tienda sin importar.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setClientImportMode("paste")}
                  className={clsx(
                    "rounded-2xl border p-4 text-left transition-all",
                    clientImportMode === "paste" ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <span className="font-semibold text-on-surface inline-flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    Sí, pegar o subir texto
                  </span>
                  <p className="mt-1 text-xs text-slate-600">Incluí encabezados; hasta ~120 filas por creación.</p>
                </button>
              </div>
              {clientImportMode === "paste" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="btn-ghost inline-flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="file"
                        accept=".csv,.txt,text/csv,text/plain"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          const reader = new FileReader();
                          reader.onload = () => setClientImportText(String(reader.result ?? ""));
                          reader.readAsText(f);
                        }}
                      />
                      Elegir archivo .csv o .txt
                    </label>
                    <span className="text-xs text-slate-500">Desde Excel: Archivo → Guardar como CSV, o copiar la tabla y pegar abajo.</span>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Pegar listado completo</label>
                    <textarea
                      value={clientImportText}
                      onChange={(e) => setClientImportText(e.target.value.slice(0, 400_000))}
                      className="input-field min-h-[200px] font-mono text-xs"
                      placeholder={"Nombre\tEmail\tTeléfono\nMaría Pérez\tmaria@mail.com\t+56912345678\n…"}
                      maxLength={400_000}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {clientImportText.length.toLocaleString("es-CL")} / 400.000 caracteres · La IA se ejecuta al pulsar «Crear tienda» en el siguiente paso.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setWizardStep(6)} className="btn-ghost">
                  Atrás
                </button>
                <button type="button" onClick={() => setWizardStep(8)} className="btn-primary inline-flex items-center gap-1">
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {wizardStep === 8 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Revisa y crea la tienda. Los datos de local y comodidades se mostrarán a quienes reserven por tu enlace público.</p>
              <ul className="space-y-2 rounded-xl border border-slate-200 bg-white/60 p-4 text-sm text-slate-700 max-h-[min(60vh,420px)] overflow-y-auto">
                <li>
                  <strong>Nombre:</strong> {name.trim() || "—"}
                </li>
                <li>
                  <strong>Tipo:</strong> {(types?.items as StoreTypeItem[])?.find((x) => x.id === typeId)?.name ?? "—"}
                </li>
                <li>
                  <strong>Razón social:</strong> {storeProfile.fiscal_chile.razon_social || "—"}
                </li>
                <li>
                  <strong>RUT empresa:</strong> {storeProfile.fiscal_chile.rut_empresa || "—"}
                </li>
                <li>
                  <strong>Dirección local (clientes):</strong> {storeProfile.location_public.direccion_atencion || "—"},{" "}
                  {storeProfile.location_public.comuna}
                </li>
                <li>
                  <strong>Horario Lun–Vie:</strong> {storeProfile.horarios.lun_vie}
                </li>
                <li>
                  <strong>Estacionamiento:</strong> {storeProfile.amenities.estacionamiento.replace(/_/g, " ")}
                  {(storeProfile.amenities.estacionamiento === "si_gratis" ||
                    storeProfile.amenities.estacionamiento === "limitado") &&
                  storeProfile.amenities.estacionamiento_plazas.trim()
                    ? ` · ${storeProfile.amenities.estacionamiento_plazas} plazas (aprox.)`
                    : ""}
                  {storeProfile.amenities.estacionamiento_detalle ? ` · ${storeProfile.amenities.estacionamiento_detalle}` : ""}
                </li>
                <li>
                  <strong>Comodidades:</strong>{" "}
                  {listSelectedAmenityLabels(storeProfile.amenities).join(", ") || "—"}
                </li>
                <li>
                  <strong>Tablero operaciones:</strong> {presetById(workflowPreset).title}
                </li>
                {workflowNotes.trim() && (
                  <li>
                    <strong>Tu flujo:</strong> {workflowNotes.trim()}
                  </li>
                )}
                <li>
                  <strong>Recordatorio citas:</strong> {reminderHours} h antes · duración por defecto {durationMin} min
                </li>
                <li>
                  <strong>Sillones / salas (primer local):</strong> {chairCount} sillones · {roomCount} salas (se crean al registrar la primera sede)
                </li>
                <li>
                  <strong>Clientes (IA):</strong>{" "}
                  {clientImportMode === "paste"
                    ? clientImportText.trim()
                      ? `Se importará el listado (${clientImportText.trim().split(/\r?\n/).length.toLocaleString("es-CL")} líneas aprox.); la IA armará perfiles con lo que reconozca.`
                      : "Elegiste importar pero el texto está vacío: no se importará nada."
                    : "Sin importación en este momento."}
                </li>
              </ul>
              <div className="flex flex-wrap gap-3 pt-2">
                <button type="button" onClick={() => setWizardStep(7)} className="btn-ghost">
                  Atrás
                </button>
                <button
                  type="button"
                  disabled={!name.trim() || !typeId || create.isPending}
                  onClick={() => create.mutate()}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                  Crear tienda
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
        {(stores?.items as StoreItem[] | undefined)?.map((s) => (
          <motion.div key={s.id} layout className="glass-card-hover p-4 flex flex-col gap-4 sm:p-6">
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 max-w-3xl">
          <h2 className="font-semibold text-on-surface mb-2 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Configuración: {configStore.name}
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Logotipo en la página pública de reservas, datos del local, horarios, comodidades, operaciones e IA.
          </p>
          <div className="space-y-8">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-on-surface">
                <ImageIcon className="h-4 w-4 text-primary" /> Logotipo del local
              </h3>
              <p className="mb-3 text-xs text-slate-500">Aparece arriba en el link de reserva pública (/book/tu-slug). JPG, PNG o WebP (máx. 5 MB).</p>
              <div className="flex flex-wrap items-center gap-4">
                {profileConfig.branding?.logo_url ? (
                  <img
                    src={fileUrl(profileConfig.branding.logo_url)}
                    alt="Logo"
                    className="h-20 w-20 rounded-xl border border-slate-200 object-contain bg-white p-1 dark:border-slate-600"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-600">
                    Sin logo
                  </div>
                )}
                <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f || !configStore) return;
                      try {
                        const fd = new FormData();
                        fd.append("file", f);
                        const r = await api.post("/uploads/store-logo", fd, {
                          headers: { "X-Store-Id": configStore.id },
                        });
                        setProfileConfig((p) => ({
                          ...p,
                          branding: { logo_url: (r.data as { url: string }).url },
                        }));
                        qc.invalidateQueries({ queryKey: ["my-stores"] });
                        toast.success("Logotipo actualizado");
                      } catch {
                        toast.error("No se pudo subir el logo");
                      }
                    }}
                  />
                  Subir logo
                </label>
              </div>
            </div>
            <div className="space-y-4 border-b border-slate-200 pb-8">
              <h3 className="text-sm font-semibold text-on-surface">Perfil de tienda (SII, local, horarios, comodidades)</h3>
              <p className="text-xs text-slate-500">
                El RUT y la razón social no se muestran en la página pública de reservas; sí dirección, horarios y estacionamiento.
              </p>
              <FiscalChileStep
                value={profileConfig.fiscal_chile}
                onChange={(fiscal_chile) => setProfileConfig((p) => ({ ...p, fiscal_chile }))}
              />
              <LocationAndHoursStep
                location={profileConfig.location_public}
                horarios={profileConfig.horarios}
                onLocation={(location_public) => setProfileConfig((p) => ({ ...p, location_public }))}
                onHorarios={(horarios) => setProfileConfig((p) => ({ ...p, horarios }))}
              />
              <AmenitiesStep
                value={profileConfig.amenities}
                onChange={(amenities) => setProfileConfig((p) => ({ ...p, amenities }))}
              />
            </div>
            <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <label className="mb-2 block text-xs font-medium text-slate-600">Tablero de tickets (Operaciones)</label>
              <p className="mb-3 text-xs text-slate-500">
                Cambia la plantilla para renombrar columnas del kanban. Los estados internos no cambian: solo lo que ve tu equipo.
              </p>
              <select
                value={configWorkflowPreset}
                onChange={(e) => setConfigWorkflowPreset(e.target.value as WorkflowPresetId)}
                className="input-field mb-3"
              >
                {WORKFLOW_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <label className="mb-1 block text-xs text-slate-500">Nota sobre tu proceso (opcional)</label>
              <textarea
                value={configWorkflowNotes}
                onChange={(e) => setConfigWorkflowNotes(e.target.value)}
                className="input-field min-h-[72px]"
                placeholder="Describe cómo trabajan los tickets en esta tienda…"
              />
            </div>
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
                <label className="text-xs text-slate-500 mb-1 block">Proveedor de mapa global</label>
                <select value={platformMapProvider} onChange={(e) => setPlatformMapProvider(e.target.value as "google" | "mapbox")} className="input-field">
                  <option value="google">Google Maps</option>
                  <option value="mapbox">Mapbox</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Aplicará para registro de clientas y tiendas.</p>
              </div>
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
              <div>
                <label className="mb-1 block text-xs text-slate-500">Sillones al crear nueva sede (plantilla)</label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={configChairCount}
                  onChange={(e) => setConfigChairCount(Math.max(0, Math.min(200, +e.target.value || 0)))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Salas al crear nueva sede (plantilla)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={configRoomCount}
                  onChange={(e) => setConfigRoomCount(Math.max(0, Math.min(100, +e.target.value || 0)))}
                  className="input-field"
                />
                <p className="mt-1 text-xs text-slate-500">Solo aplica cuando la sede aún no tiene puestos registrados.</p>
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
          </div>
        </motion.div>
      )}

      {stores?.items?.length === 0 && !showForm && (
        <div className="text-center py-16 glass-card">
          {canCreateStores ? (
            <>
              <p className="text-slate-500 mb-4">Aún no tienes tiendas. Crea una para comenzar.</p>
              <button
                type="button"
                onClick={() => {
                  setShowForm(true);
                  setWizardStep(1);
                  setWorkflowNotes("");
                  setName("");
                  setWorkflowPreset("sales");
                  setBusinessCtx("");
                  setTone("professional");
                  setDurationMin(30);
                  setReminderHours(24);
                  setChairCount(4);
                  setRoomCount(1);
                  setStoreProfile(emptyStoreProfile());
                }}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Crear primera tienda
              </button>
            </>
          ) : (
            <p className="mx-auto max-w-md text-slate-600">
              Tu cuenta no tiene tiendas asignadas. Solo un administrador de la plataforma puede dar de alta un local y
              asociarte; desde la tienda solo gestionás tu negocio, sin crear otros tenants ni ver datos de otros locales.
            </p>
          )}
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
