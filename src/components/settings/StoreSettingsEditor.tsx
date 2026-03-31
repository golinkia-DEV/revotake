"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ImageIcon, Loader2, Save, Sparkles, ToggleLeft, ToggleRight } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { getUser } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { WORKFLOW_PRESETS, type WorkflowPresetId } from "@/lib/operationsWorkflow";
import { emptyStoreProfile, mergeStoreProfileFromApi, type StoreProfile } from "@/lib/storeProfile";
import { FiscalChileStep, LocationAndHoursStep, AmenitiesStep } from "@/components/store/StoreProfileWizardSections";

const CONTEXT_CHAR_LIMIT = 8000;

export type SettingsEditorTab = "tienda" | "contexto" | "modo" | "ayuda";

type StoreApi = {
  id: string;
  name: string;
  slug: string;
  store_type_id: string;
  store_type?: { name: string; slug: string; description: string | null } | null;
  settings: Record<string, unknown>;
};

export function StoreSettingsEditor({ storeId, activeTab }: { storeId: string; activeTab: SettingsEditorTab }) {
  const qc = useQueryClient();
  const platformAdmin = getUser()?.role === "admin";

  const { data: storeData, isLoading } = useQuery({
    queryKey: ["store", storeId],
    queryFn: () => api.get(`/stores/${storeId}`).then((r) => r.data as StoreApi),
    enabled: !!storeId,
  });

  const [storeName, setStoreName] = useState("");
  const [profileConfig, setProfileConfig] = useState<StoreProfile>(() => emptyStoreProfile());
  const [workflowPreset, setWorkflowPreset] = useState<WorkflowPresetId>("generic");
  const [workflowNotes, setWorkflowNotes] = useState("");
  const [businessCtx, setBusinessCtx] = useState("");
  const [strictMode, setStrictMode] = useState(false);
  const [tone, setTone] = useState("professional");
  const [durationMin, setDurationMin] = useState(30);
  const [reminderHours, setReminderHours] = useState(24);
  const [chairCount, setChairCount] = useState(0);
  const [roomCount, setRoomCount] = useState(0);
  const [platformMapProvider, setPlatformMapProvider] = useState<"google" | "mapbox">("google");

  useEffect(() => {
    if (!storeData) return;
    setStoreName(storeData.name || "");
    setProfileConfig(mergeStoreProfileFromApi(storeData.settings?.store_profile));
    const ai = (storeData.settings?.ai as Record<string, unknown>) || {};
    const ag = (storeData.settings?.agenda as Record<string, number>) || {};
    const op = (storeData.settings?.operations as Record<string, unknown>) || {};
    const loc = (storeData.settings?.local_structure as Record<string, unknown>) || {};
    const platformCfg = (storeData.settings?.platform as Record<string, string>) || {};

    setBusinessCtx(typeof ai.business_context === "string" ? ai.business_context : "");
    setStrictMode(!!ai.strict_mode);
    setTone(typeof ai.tone === "string" ? ai.tone : "professional");
    setDurationMin(ag.default_duration_minutes ?? 30);
    setReminderHours(ag.reminder_hours_before ?? 24);
    const p = op.preset as WorkflowPresetId | undefined;
    setWorkflowPreset(p && WORKFLOW_PRESETS.some((x) => x.id === p) ? p : "generic");
    setWorkflowNotes(typeof op.workflow_notes === "string" ? op.workflow_notes : "");
    setChairCount(typeof loc.chair_count === "number" ? loc.chair_count : Number(loc.chair_count) || 0);
    setRoomCount(typeof loc.room_count === "number" ? loc.room_count : Number(loc.room_count) || 0);
    setPlatformMapProvider(platformCfg.map_provider === "mapbox" ? "mapbox" : "google");
  }, [storeData]);

  const save = useMutation({
    mutationFn: async () => {
      if (!storeData) return;
      const base = { ...storeData.settings };
      await api.patch(
        `/stores/${storeId}`,
        {
          name: storeName.trim(),
          settings: {
            ...base,
            store_profile: profileConfig,
            operations: {
              ...((base.operations as object) || {}),
              preset: workflowPreset,
              workflow_notes: workflowNotes.trim(),
            },
            ai: {
              ...((base.ai as Record<string, unknown>) || {}),
              business_context: businessCtx.slice(0, CONTEXT_CHAR_LIMIT),
              strict_mode: strictMode,
              tone,
            },
            agenda: {
              ...((base.agenda as Record<string, number>) || {}),
              default_duration_minutes: durationMin,
              reminder_hours_before: Math.max(1, Math.min(168, reminderHours)),
            },
            local_structure: {
              chair_count: Math.max(0, Math.min(200, chairCount)),
              room_count: Math.max(0, Math.min(100, roomCount)),
            },
            platform: {
              ...((base.platform as Record<string, string>) || {}),
              map_provider: platformMapProvider,
            },
          },
        },
        { headers: { "X-Store-Id": storeId } }
      );
      if (platformAdmin) {
        await api.patch("/stores/platform/map-provider", { map_provider: platformMapProvider });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store", storeId] });
      qc.invalidateQueries({ queryKey: ["my-stores"] });
      toast.success("Configuración guardada");
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { status?: number; data?: { detail?: string } } };
      if (ax.response?.status === 403) {
        toast.error("Solo gerentes de tienda o sucursal pueden editar estos datos.");
        return;
      }
      toast.error("No se pudo guardar la configuración");
    },
  });

  if (isLoading || !storeData) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const showSave = activeTab !== "ayuda";

  return (
    <>
      {activeTab === "tienda" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="glass-card p-6">
            <h2 className="mb-1 font-semibold text-on-surface">Identificación del local</h2>
            <p className="mb-4 text-sm text-slate-500">Mismo nombre y rubro que al dar de alta la tienda. El tipo de negocio no se puede cambiar desde aquí; contactá a soporte si necesitás otro rubro.</p>
            <label className="mb-1 block text-xs font-medium text-slate-500">Nombre de la tienda</label>
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="input-field mb-4 max-w-xl"
              placeholder="Nombre comercial"
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/40">
              <p className="font-medium text-on-surface">Tipo de negocio</p>
              <p className="text-slate-700 dark:text-slate-300">{storeData.store_type?.name ?? "—"}</p>
              {storeData.store_type?.description && (
                <p className="mt-1 text-xs text-slate-500">{storeData.store_type.description}</p>
              )}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-on-surface">
              <ImageIcon className="h-4 w-4 text-primary" /> Logotipo del local
            </h2>
            <p className="mb-3 text-xs text-slate-500">Aparece en la reserva pública (/book/tu-slug). JPG, PNG o WebP (máx. 5 MB).</p>
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
              <label className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    try {
                      const fd = new FormData();
                      fd.append("file", f);
                      const r = await api.post("/uploads/store-logo", fd, { headers: { "X-Store-Id": storeId } });
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

          <div className="glass-card p-6">
            <h2 className="mb-2 text-sm font-semibold text-on-surface">Perfil de tienda (SII, local, horarios, comodidades)</h2>
            <p className="mb-4 text-xs text-slate-500">
              El RUT y la razón social no se muestran en la página pública de reservas; sí dirección, horarios y estacionamiento.
            </p>
            <FiscalChileStep value={profileConfig.fiscal_chile} onChange={(fiscal_chile) => setProfileConfig((p) => ({ ...p, fiscal_chile }))} />
            <LocationAndHoursStep
              location={profileConfig.location_public}
              horarios={profileConfig.horarios}
              onLocation={(location_public) => setProfileConfig((p) => ({ ...p, location_public }))}
              onHorarios={(horarios) => setProfileConfig((p) => ({ ...p, horarios }))}
            />
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700">
              <p className="mb-2 text-xs font-medium text-slate-600">
                Vista previa de mapa ({platformMapProvider === "mapbox" ? "Mapbox" : "Google"})
              </p>
              {platformMapProvider === "google" ? (
                <iframe
                  title="store-map-google"
                  className="h-48 w-full rounded-lg border-0"
                  loading="lazy"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(
                    `${profileConfig.location_public.direccion_atencion} ${profileConfig.location_public.comuna} Chile`
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
            <div className="mt-4">
              <AmenitiesStep value={profileConfig.amenities} onChange={(amenities) => setProfileConfig((p) => ({ ...p, amenities }))} />
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="mb-2 text-sm font-semibold text-on-surface">Operaciones (tablero de tickets)</h2>
            <p className="mb-3 text-xs text-slate-500">Plantilla del Kanban: renombra columnas para tu equipo sin cambiar la lógica interna.</p>
            <select
              value={workflowPreset}
              onChange={(e) => setWorkflowPreset(e.target.value as WorkflowPresetId)}
              className="input-field mb-3 max-w-lg"
            >
              {WORKFLOW_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <label className="mb-1 block text-xs text-slate-500">Nota sobre tu proceso (opcional)</label>
            <textarea
              value={workflowNotes}
              onChange={(e) => setWorkflowNotes(e.target.value)}
              className="input-field min-h-[80px]"
              placeholder="Ej.: Primero tomamos el dato por WhatsApp…"
            />
          </div>

          <div className="glass-card p-6">
            <h2 className="mb-2 text-sm font-semibold text-on-surface">Agenda e IA (ajustes rápidos)</h2>
            <p className="mb-4 text-xs text-slate-500">Tono, duración por defecto y recordatorios. El texto largo del negocio va en la pestaña «Contexto IA».</p>
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
                <label className="mb-1 block text-xs text-slate-500">Duración típica de cita (minutos)</label>
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
                <p className="mt-1 text-xs text-slate-500">Correo al cliente cuando aplique.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Sillones / puestos (plantilla nuevas sedes)</label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={chairCount}
                  onChange={(e) => setChairCount(Math.max(0, Math.min(200, +e.target.value || 0)))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Salas / cabinas (plantilla)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={roomCount}
                  onChange={(e) => setRoomCount(Math.max(0, Math.min(100, +e.target.value || 0)))}
                  className="input-field"
                />
                <p className="mt-1 text-xs text-slate-500">Solo orientativo al crear sedes sin puestos aún.</p>
              </div>
              {platformAdmin && (
                <div className="sm:col-span-2 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <label className="mb-1 block text-xs font-medium text-amber-900 dark:text-amber-200">Proveedor de mapa (plataforma)</label>
                  <select
                    value={platformMapProvider}
                    onChange={(e) => setPlatformMapProvider(e.target.value as "google" | "mapbox")}
                    className="input-field max-w-xs"
                  >
                    <option value="google">Google Maps</option>
                    <option value="mapbox">Mapbox</option>
                  </select>
                  <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-300/90">Solo administrador global: afecta la app en conjunto.</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === "contexto" && (
        <motion.div id="ai-context" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tertiary/10 text-tertiary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-on-surface">Contexto del negocio</h2>
              <p className="text-sm text-slate-500">
                Servicios, precios, horarios, políticas, ubicación y formas de pago. La IA usa este texto en el chat y en respuestas automáticas.
              </p>
            </div>
          </div>
          <textarea
            value={businessCtx}
            onChange={(e) => setBusinessCtx(e.target.value.slice(0, CONTEXT_CHAR_LIMIT))}
            rows={14}
            className="input-field w-full resize-none font-mono text-sm"
            placeholder="Describe tu negocio con el detalle que necesiten tus clientas…"
          />
          <div className={`mt-1 text-right text-xs ${businessCtx.length > CONTEXT_CHAR_LIMIT * 0.9 ? "text-amber-600" : "text-slate-400"}`}>
            {businessCtx.length.toLocaleString()} / {CONTEXT_CHAR_LIMIT.toLocaleString()} caracteres
          </div>
        </motion.div>
      )}

      {activeTab === "modo" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-on-surface">Modo estricto</h2>
              <p className="mt-1 text-sm text-slate-500">
                Si está activo, la IA solo responde con la información del contexto; si no sabe, lo dirá en lugar de inventar.
              </p>
            </div>
            <button type="button" onClick={() => setStrictMode((v) => !v)} className="shrink-0" aria-pressed={strictMode}>
              {strictMode ? <ToggleRight className="h-8 w-8 text-primary" /> : <ToggleLeft className="h-8 w-8 text-slate-400" />}
            </button>
          </div>
          {strictMode && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Modo estricto activado: la IA responderá que no tiene información si la pregunta no está cubierta en el contexto.
            </div>
          )}
        </motion.div>
      )}

      {activeTab === "ayuda" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
        >
          <p className="mb-2 font-semibold text-slate-700 dark:text-slate-300">¿Qué configurás aquí?</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>
              <strong>Datos de la tienda</strong>: lo mismo que en el asistente de alta (nombre, logo, datos SII, dirección, horarios, comodidades, Kanban, agenda
              y plantilla de puestos).
            </li>
            <li>El contexto largo del negocio y el modo estricto se guardan junto con el resto al pulsar «Guardar configuración».</li>
            <li>El <strong>Asistente IA</strong> del menú usa tono, contexto y modo estricto definidos aquí.</li>
          </ul>
        </motion.div>
      )}

      {showSave && (
        <div className="mt-6 flex justify-end border-t border-slate-200 pt-6 dark:border-slate-800">
          <button
            type="button"
            disabled={save.isPending || !storeName.trim()}
            onClick={() => save.mutate()}
            className="btn-primary inline-flex items-center gap-2"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {save.isPending ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      )}
    </>
  );
}
