"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Check, ChevronRight, GripVertical, Pencil,
  RotateCcw, Save, Eye, EyeOff, Sparkles, Info,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { getStoreId } from "@/lib/store";
import { toast } from "sonner";
import clsx from "clsx";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  WORKFLOW_PRESETS, KANBAN_COLUMN_ORDER, COLUMN_COLORS, PRESET_CATEGORIES,
  presetById, type WorkflowPresetId, type KanbanColumnId, type OperationsSettings,
} from "@/lib/operationsWorkflow";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ColumnDraft {
  id: KanbanColumnId;
  label: string;
  description: string;
  icon: string;
  color: string;
  visible: boolean;
}

const COLOR_OPTIONS = [
  { key: "blue",   label: "Azul",    cls: "bg-blue-400" },
  { key: "purple", label: "Violeta", cls: "bg-purple-400" },
  { key: "amber",  label: "Ámbar",   cls: "bg-amber-400" },
  { key: "cyan",   label: "Cian",    cls: "bg-cyan-400" },
  { key: "emerald",label: "Verde",   cls: "bg-emerald-400" },
  { key: "orange", label: "Naranja", cls: "bg-orange-400" },
  { key: "rose",   label: "Rosa",    cls: "bg-rose-400" },
  { key: "slate",  label: "Gris",    cls: "bg-slate-400" },
  { key: "pink",   label: "Pink",    cls: "bg-pink-400" },
  { key: "teal",   label: "Teal",    cls: "bg-teal-400" },
  { key: "violet", label: "Violeta2",cls: "bg-violet-400" },
  { key: "lime",   label: "Lima",    cls: "bg-lime-400" },
];

const ICON_OPTIONS = [
  "today", "directions_walk", "person_check", "done_all", "payments", "event_repeat",
  "person_off", "archive", "spa", "login", "hot_tub", "self_improvement", "check_circle",
  "rate_review", "cancel", "queue", "record_voice_over", "content_cut", "thumb_up",
  "point_of_sale", "loyalty", "add_circle", "assignment_ind", "stethoscope", "lab_research",
  "medication", "event_available", "verified", "shopping_bag", "inventory", "package_2",
  "local_shipping", "support_agent", "phone_disabled", "person_add", "star", "calendar_month",
  "description", "emoji_events", "follow_the_signs", "phone_missed", "lock",
  "confirmation_number", "manage_search", "task_alt", "pending_actions", "done",
  "fiber_new", "event", "autorenew", "update", "hourglass_empty", "label", "grade",
];

// ─── Step 1: Template gallery ─────────────────────────────────────────────────

function TemplateGallery({ selected, onSelect }: {
  selected: WorkflowPresetId; onSelect: (id: WorkflowPresetId) => void;
}) {
  const [catFilter, setCatFilter] = useState("all");
  const cats = ["all", ...PRESET_CATEGORIES];
  const filtered = catFilter === "all" ? WORKFLOW_PRESETS : WORKFLOW_PRESETS.filter((p) => p.category === catFilter);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-on-surface mb-1">Elegí una plantilla base</h2>
        <p className="text-sm text-slate-500">Podés personalizar cada columna en el siguiente paso. Empezá por la que más se parece a tu negocio.</p>
      </div>

      {/* Category tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => setCatFilter(c)}
            className={clsx("rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              catFilter === c ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700")}>
            {c === "all" ? "Todos" : c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((preset) => {
          const isSelected = selected === preset.id;
          return (
            <motion.button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset.id)}
              whileHover={{ y: -2 }}
              className={clsx(
                "group relative rounded-2xl border-2 p-5 text-left transition-all",
                isSelected ? "border-primary bg-primary/5 shadow-md" : "border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/50"
              )}
            >
              {isSelected && (
                <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div className="mb-3 flex items-center gap-3">
                <span className="text-3xl">{preset.emoji}</span>
                <div>
                  <h3 className="font-bold text-on-surface">{preset.title}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800">{preset.category}</span>
                </div>
              </div>
              <p className="mb-4 text-sm text-slate-500">{preset.description}</p>

              {/* Column preview pills */}
              <div className="flex flex-wrap gap-1.5">
                {KANBAN_COLUMN_ORDER.slice(0, 5).map((colId) => {
                  const col = preset.columns[colId];
                  const colorKey = col.color;
                  const borderCls = COLUMN_COLORS[colorKey] ?? "border-slate-300";
                  return (
                    <span key={colId}
                      className={clsx("rounded-full border-l-4 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400", borderCls)}>
                      {col.label}
                    </span>
                  );
                })}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800">+{KANBAN_COLUMN_ORDER.length - 5}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Column editor row ────────────────────────────────────────────────────────

function ColumnEditorRow({ col, index, onChange }: {
  col: ColumnDraft; index: number; onChange: (id: KanbanColumnId, patch: Partial<ColumnDraft>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const borderCls = COLUMN_COLORS[col.color] ?? "border-slate-300";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        "rounded-2xl border-l-4 border border-slate-200 bg-white transition-all dark:border-slate-700 dark:bg-slate-900/50",
        borderCls,
        !col.visible && "opacity-50"
      )}
    >
      <div className="flex items-center gap-3 p-4">
        {/* Drag handle placeholder */}
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-300" />

        {/* Icon */}
        <button type="button" onClick={() => setShowIcons(!showIcons)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 transition-colors hover:border-primary/40 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-800"
          title="Cambiar ícono">
          <MaterialIcon name={col.icon} className="text-lg text-slate-600 dark:text-slate-400" />
        </button>

        {/* Label input */}
        <input
          value={col.label}
          onChange={(e) => onChange(col.id, { label: e.target.value })}
          className="flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold text-on-surface outline-none transition-all focus:border-primary/30 focus:bg-primary/5"
          placeholder="Nombre de columna"
        />

        {/* Color dots */}
        <div className="flex shrink-0 gap-1">
          {COLOR_OPTIONS.slice(0, 5).map((c) => (
            <button key={c.key} type="button" onClick={() => onChange(col.id, { color: c.key })}
              title={c.label}
              className={clsx("h-4 w-4 rounded-full border-2 transition-transform hover:scale-125", c.cls,
                col.color === c.key ? "border-white ring-2 ring-slate-400" : "border-transparent")} />
          ))}
          <button type="button" onClick={() => setExpanded(!expanded)}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[8px] text-slate-600 hover:bg-slate-300 dark:bg-slate-700">
            +
          </button>
        </div>

        {/* Visibility toggle */}
        <button type="button" onClick={() => onChange(col.id, { visible: !col.visible })}
          className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          title={col.visible ? "Ocultar columna" : "Mostrar columna"}>
          {col.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>

        <button type="button" onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-slate-400 hover:text-primary">
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded: all colors + description */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-slate-200 px-4 pb-4 pt-3 dark:border-slate-700 space-y-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-500">Color de columna</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button key={c.key} type="button" onClick={() => onChange(col.id, { color: c.key })}
                      className={clsx("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
                        col.color === c.key ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400")}>
                      <span className={clsx("h-3 w-3 rounded-full", c.cls)} />{c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Descripción (se muestra en el board al hacer hover)</label>
                <input value={col.description} onChange={(e) => onChange(col.id, { description: e.target.value })}
                  className="input-field text-sm" placeholder="Explica qué significa esta etapa para tu equipo…" />
              </div>
            </div>
          </motion.div>
        )}
        {showIcons && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-slate-200 px-4 pb-4 pt-3 dark:border-slate-700">
              <label className="mb-2 block text-xs font-medium text-slate-500">Ícono de columna</label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((ico) => (
                  <button key={ico} type="button" onClick={() => { onChange(col.id, { icon: ico }); setShowIcons(false); }}
                    title={ico}
                    className={clsx("flex h-9 w-9 items-center justify-center rounded-xl border transition-all hover:border-primary/40 hover:bg-primary/5",
                      col.icon === ico ? "border-primary bg-primary/10" : "border-slate-200 dark:border-slate-700")}>
                    <MaterialIcon name={ico} className="text-lg text-slate-600 dark:text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Step 2: Column customizer ────────────────────────────────────────────────

function ColumnCustomizer({ columns, onChangeColumn, onReset }: {
  columns: ColumnDraft[];
  onChangeColumn: (id: KanbanColumnId, patch: Partial<ColumnDraft>) => void;
  onReset: () => void;
}) {
  const visibleCount = columns.filter((c) => c.visible).length;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-on-surface mb-1">Personalizá tu flujo</h2>
          <p className="text-sm text-slate-500">
            Renombrá cada columna, cambiá el color y ícono. Ocultá las etapas que no uses.
            <strong className="text-on-surface"> {visibleCount} de {columns.length}</strong> columnas visibles.
          </p>
        </div>
        <button type="button" onClick={onReset}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
          <RotateCcw className="h-4 w-4" /> Restablecer plantilla
        </button>
      </div>

      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3">
        <Info className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Hacé click en el ícono de lápiz para editar descripción y colores extendidos. Hacé click en el ojo para ocultar una columna sin borrarla.
        </p>
      </div>

      <div className="space-y-3">
        {columns.map((col, i) => (
          <ColumnEditorRow key={col.id} col={col} index={i} onChange={onChangeColumn} />
        ))}
      </div>
    </div>
  );
}

// ─── Step 3: Preview ──────────────────────────────────────────────────────────

function WorkflowPreview({ columns, presetTitle, workflowNotes, onNotesChange }: {
  columns: ColumnDraft[]; presetTitle: string;
  workflowNotes: string; onNotesChange: (v: string) => void;
}) {
  const visible = columns.filter((c) => c.visible);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-on-surface mb-1">Vista previa y guardar</h2>
        <p className="text-sm text-slate-500">Así verá tu equipo el tablero de Operaciones. Podés agregar una nota de contexto.</p>
      </div>

      {/* Preview board */}
      <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <div className="flex gap-3" style={{ minWidth: `${visible.length * 160}px` }}>
          {visible.map((col) => {
            const borderCls = COLUMN_COLORS[col.color] ?? "border-slate-300";
            return (
              <div key={col.id} className="w-40 shrink-0">
                <div className={clsx("mb-2 rounded-xl border-t-4 bg-white p-3 shadow-sm dark:bg-slate-900", borderCls)}>
                  <div className="flex items-center gap-2 mb-1">
                    <MaterialIcon name={col.icon} className="text-base text-slate-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-tight">{col.label}</span>
                  </div>
                  {col.description && (
                    <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">{col.description}</p>
                  )}
                </div>
                {/* Sample card */}
                <div className="rounded-xl bg-white p-2.5 shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                  <div className="h-2 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700 mb-1.5" />
                  <div className="h-2 w-1/2 rounded-full bg-slate-100 dark:bg-slate-800" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workflow notes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
        <label className="mb-1 block text-sm font-semibold text-on-surface">
          <Sparkles className="inline h-4 w-4 mr-1 text-primary" />
          Nota de flujo (opcional)
        </label>
        <p className="mb-3 text-xs text-slate-500">Describí brevemente cómo funciona tu proceso. Se muestra en el encabezado del tablero para orientar al equipo.</p>
        <textarea value={workflowNotes} onChange={(e) => onNotesChange(e.target.value)}
          className="input-field min-h-[80px] resize-none text-sm"
          placeholder="Ej: Cada clienta entra en 'Citas de hoy' al confirmar turno. El equipo la mueve a 'En atención' al comenzar el servicio y a 'Cobrado' al finalizar…" />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkflowDesignerPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPreset, setSelectedPreset] = useState<WorkflowPresetId>("estetica");
  const [columns, setColumns] = useState<ColumnDraft[]>([]);
  const [workflowNotes, setWorkflowNotes] = useState("");
  const [initialized, setInitialized] = useState(false);

  const { data: storeData } = useQuery({
    queryKey: ["store", storeId],
    queryFn: () => api.get(`/stores/${storeId}`).then((r) => r.data),
    enabled: !!storeId,
  });

  // Initialize from existing store settings
  useEffect(() => {
    if (!storeData || initialized) return;
    setInitialized(true);
    const ops = storeData.settings?.operations as Record<string, unknown> | undefined;
    if (ops?.preset) setSelectedPreset(ops.preset as WorkflowPresetId);
    if (ops?.workflow_notes) setWorkflowNotes(ops.workflow_notes as string);
    applyPreset(ops?.preset as WorkflowPresetId || "estetica", ops);
  }, [storeData, initialized]);

  function applyPreset(presetId: WorkflowPresetId, overrides?: Record<string, unknown> | null) {
    const p = presetById(presetId);
    const overrideLabels = (overrides?.column_labels as Record<string, string>) || {};
    const overrideDescs  = (overrides?.column_descriptions as Record<string, string>) || {};
    const overrideIcons  = (overrides?.column_icons as Record<string, string>) || {};
    const overrideColors = (overrides?.column_colors as Record<string, string>) || {};
    const overrideVis    = (overrides?.column_visible as Record<string, boolean>) || {};

    setColumns(
      KANBAN_COLUMN_ORDER.map((id) => ({
        id,
        label:       overrideLabels[id] ?? p.columns[id].label,
        description: overrideDescs[id]  ?? p.columns[id].description,
        icon:        overrideIcons[id]  ?? p.columns[id].icon,
        color:       overrideColors[id] ?? p.columns[id].color,
        visible:     overrideVis[id]    ?? p.columns[id].visible ?? true,
      }))
    );
  }

  function handleSelectPreset(id: WorkflowPresetId) {
    setSelectedPreset(id);
    applyPreset(id);
  }

  function handleChangeColumn(id: KanbanColumnId, patch: Partial<ColumnDraft>) {
    setColumns((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
  }

  function handleReset() {
    applyPreset(selectedPreset);
  }

  const save = useMutation({
    mutationFn: () => {
      const col_labels: Record<string, string> = {};
      const col_descs:  Record<string, string> = {};
      const col_icons:  Record<string, string> = {};
      const col_colors: Record<string, string> = {};
      const col_vis:    Record<string, boolean> = {};

      for (const c of columns) {
        col_labels[c.id] = c.label;
        col_descs[c.id]  = c.description;
        col_icons[c.id]  = c.icon;
        col_colors[c.id] = c.color;
        col_vis[c.id]    = c.visible;
      }

      const opsSettings: Record<string, unknown> = {
        preset: selectedPreset,
        workflow_notes: workflowNotes,
        column_labels: col_labels,
        column_descriptions: col_descs,
        column_icons: col_icons,
        column_colors: col_colors,
        column_visible: col_vis,
        wizard_version: 2,
      };

      return api.patch(`/stores/${storeId}`, {
        settings: { ...storeData?.settings, operations: opsSettings },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store", storeId] });
      qc.invalidateQueries({ queryKey: ["store-detail", storeId] });
      toast.success("Flujo de trabajo guardado. El tablero ya refleja los cambios.");
      router.push("/kanban");
    },
    onError: () => toast.error("Error al guardar el flujo"),
  });

  const selectedPresetData = presetById(selectedPreset);

  const steps = [
    { n: 1, label: "Plantilla" },
    { n: 2, label: "Personalizar" },
    { n: 3, label: "Vista previa" },
  ];

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8">
        <Link href="/kanban" className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Volver al tablero
        </Link>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">Operaciones</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-on-surface mb-2">Diseñador de flujo</h1>
        <p className="text-sm text-slate-500 max-w-2xl">
          Configurá las columnas del tablero de Operaciones según tu tipo de negocio.
          Cada columna representa una etapa del recorrido de tu cliente o pedido.
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <button type="button" onClick={() => { if (s.n < step || columns.length > 0) setStep(s.n as 1 | 2 | 3); }}
              className={clsx("flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                step === s.n ? "bg-primary text-white shadow-md shadow-primary/30"
                : step > s.n ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500")}>
              {step > s.n ? <Check className="h-4 w-4" /> : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-current/20 text-xs">{s.n}</span>}
              {s.label}
            </button>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          {step === 1 && (
            <TemplateGallery selected={selectedPreset} onSelect={handleSelectPreset} />
          )}
          {step === 2 && (
            <ColumnCustomizer columns={columns} onChangeColumn={handleChangeColumn} onReset={handleReset} />
          )}
          {step === 3 && (
            <WorkflowPreview columns={columns} presetTitle={selectedPresetData.title} workflowNotes={workflowNotes} onNotesChange={setWorkflowNotes} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="mt-10 flex items-center justify-between border-t border-slate-200 pt-6 dark:border-slate-700">
        <div>
          {step > 1 && (
            <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)} className="btn-ghost flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Anterior
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {step < 3 ? (
            <button type="button"
              onClick={() => { if (step === 1 && columns.length === 0) applyPreset(selectedPreset); setStep((s) => Math.min(3, s + 1) as 1 | 2 | 3); }}
              className="btn-primary flex items-center gap-2">
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={() => save.mutate()} disabled={save.isPending || !storeId}
              className="btn-primary flex items-center gap-2">
              <Save className="h-4 w-4" />
              {save.isPending ? "Guardando…" : "Guardar y activar flujo"}
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
