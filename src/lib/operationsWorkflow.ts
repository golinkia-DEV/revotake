/**
 * Cada tienda puede elegir un "preset" de etiquetas para el tablero de tickets.
 * Los estados en backend (TicketStatus) son fijos; solo cambian los textos mostrados.
 */

export const KANBAN_COLUMN_ORDER = [
  "new",
  "qualified",
  "meeting_scheduled",
  "data_received",
  "sold",
  "follow_up",
  "no_response",
  "closed",
] as const;

export type KanbanColumnId = (typeof KANBAN_COLUMN_ORDER)[number];

const COLORS: Record<KanbanColumnId, string> = {
  new: "border-blue-400",
  qualified: "border-purple-400",
  meeting_scheduled: "border-amber-400",
  data_received: "border-cyan-400",
  sold: "border-emerald-400",
  follow_up: "border-orange-400",
  no_response: "border-rose-400",
  closed: "border-slate-400",
};

const DEFAULT_LABELS: Record<KanbanColumnId, string> = {
  new: "Nuevo",
  qualified: "Calificado",
  meeting_scheduled: "Reunión",
  data_received: "Datos recibidos",
  sold: "Vendido",
  follow_up: "Seguimiento",
  no_response: "Sin respuesta",
  closed: "Cerrado",
};

export type WorkflowPresetId = "sales" | "support" | "health" | "retail" | "generic";

export interface WorkflowPreset {
  id: WorkflowPresetId;
  title: string;
  description: string;
  /** Texto corto para el tablero */
  hint: string;
  column_labels: Partial<Record<KanbanColumnId, string>>;
}

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: "sales",
    title: "Ventas y embudo",
    description: "Ideal para leads, reuniones y cierre. Arrastra tarjetas de izquierda a derecha según avance el negocio.",
    hint: "Cada columna es una etapa del embudo de esta tienda.",
    column_labels: {
      new: "Lead nuevo",
      qualified: "Calificado",
      meeting_scheduled: "Reunión agendada",
      data_received: "Propuesta / datos",
      sold: "Ganado",
      follow_up: "Seguimiento",
      no_response: "Sin respuesta",
      closed: "Cerrado",
    },
  },
  {
    id: "support",
    title: "Soporte e incidencias",
    description: "Prioriza tickets entrantes, diagnóstico y cierre. Misma lógica de arrastre, distintos nombres.",
    hint: "Adapta el lenguaje a tickets de soporte o mesa de ayuda.",
    column_labels: {
      new: "Nuevo ticket",
      qualified: "En análisis",
      meeting_scheduled: "Escalado / llamada",
      data_received: "Info recibida",
      sold: "Resuelto (OK)",
      follow_up: "Pendiente cliente",
      no_response: "Sin respuesta",
      closed: "Cerrado",
    },
  },
  {
    id: "health",
    title: "Salud y citas",
    description: "Pensado para clínicas: solicitud, evaluación, cita y seguimiento.",
    hint: "Las columnas reflejan el recorrido del paciente o la cita.",
    column_labels: {
      new: "Solicitud",
      qualified: "Evaluación",
      meeting_scheduled: "Cita",
      data_received: "Exámenes / datos",
      sold: "Tratamiento / pago",
      follow_up: "Control",
      no_response: "No asistió",
      closed: "Finalizado",
    },
  },
  {
    id: "retail",
    title: "Tienda y pedidos",
    description: "Pedidos, preparación y entrega. El tablero ordena el flujo operativo del local.",
    hint: "Útil para pedidos, reservas de producto o encargos.",
    column_labels: {
      new: "Nuevo pedido",
      qualified: "Confirmado",
      meeting_scheduled: "Retiro / envío",
      data_received: "Datos de entrega",
      sold: "Entregado / cobrado",
      follow_up: "Postventa",
      no_response: "Cliente no responde",
      closed: "Archivado",
    },
  },
  {
    id: "generic",
    title: "Genérico (etiquetas neutras)",
    description: "Nombres equilibrados si tu proceso no encaja en las plantillas.",
    hint: "Puedes describir tu proceso en la nota de la tienda.",
    column_labels: {},
  },
];

export function presetById(id: string | undefined): WorkflowPreset {
  const p = WORKFLOW_PRESETS.find((x) => x.id === id);
  return p ?? WORKFLOW_PRESETS.find((x) => x.id === "generic")!;
}

export interface OperationsSettings {
  preset?: string;
  workflow_notes?: string;
  column_labels?: Partial<Record<string, string>>;
  wizard_version?: number;
}

export function getKanbanColumns(settings: { operations?: OperationsSettings } | null | undefined): {
  id: KanbanColumnId;
  label: string;
  color: string;
}[] {
  const ops = settings?.operations;
  const preset = presetById(ops?.preset);
  const overrides = ops?.column_labels || {};
  return KANBAN_COLUMN_ORDER.map((id) => ({
    id,
    label: overrides[id] ?? preset.column_labels[id] ?? DEFAULT_LABELS[id],
    color: COLORS[id],
  }));
}

export const WIZARD_HELP_TEXT = {
  title: "Asistentes paso a paso (wizards)",
  body:
    "En RevoTake encontrarás formularios guiados: al crear clientes verás campos claros y fechas con calendario; en Agenda el flujo de reservas te lleva paso a paso. Este tablero resume tus tickets: arrastra entre columnas para cambiar el estado. Si algo no encaja, elige «Genérico» y describe tu proceso en la nota.",
};
