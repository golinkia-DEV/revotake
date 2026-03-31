/**
 * Workflow de operaciones configurable por tienda.
 * El backend tiene 8 estados fijos; solo cambian las etiquetas, colores y
 * descripciones que ve el administrador y el equipo.
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

export const COLUMN_COLORS: Record<string, string> = {
  blue: "border-blue-400",
  purple: "border-purple-400",
  amber: "border-amber-400",
  cyan: "border-cyan-400",
  emerald: "border-emerald-400",
  orange: "border-orange-400",
  rose: "border-rose-400",
  slate: "border-slate-400",
  pink: "border-pink-400",
  violet: "border-violet-400",
  teal: "border-teal-400",
  lime: "border-lime-400",
};

export const COLUMN_COLOR_NAMES: Record<KanbanColumnId, string> = {
  new: "blue",
  qualified: "purple",
  meeting_scheduled: "amber",
  data_received: "cyan",
  sold: "emerald",
  follow_up: "orange",
  no_response: "rose",
  closed: "slate",
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

// ─── Column definitions per preset ───────────────────────────────────────────

export interface ColumnConfig {
  label: string;
  description: string;
  icon: string;
  hint: string; // quick automation hint shown in the board
  color: string;
  visible?: boolean;
}

export type PresetColumns = Record<KanbanColumnId, ColumnConfig>;

// ─── Presets ──────────────────────────────────────────────────────────────────

export type WorkflowPresetId =
  | "estetica"
  | "spa"
  | "barberia"
  | "salud"
  | "retail"
  | "sales"
  | "support"
  | "generic";

export interface WorkflowPreset {
  id: WorkflowPresetId;
  title: string;
  category: string;
  emoji: string;
  description: string;
  hint: string;
  columns: PresetColumns;
  /** Legacy: used by old getKanbanColumns */
  column_labels: Partial<Record<KanbanColumnId, string>>;
}

function makePreset(
  id: WorkflowPresetId,
  meta: { title: string; category: string; emoji: string; description: string; hint: string },
  cols: Record<KanbanColumnId, Omit<ColumnConfig, "color" | "visible"> & { color?: string }>
): WorkflowPreset {
  const columns = {} as PresetColumns;
  const column_labels: Partial<Record<KanbanColumnId, string>> = {};
  for (const key of KANBAN_COLUMN_ORDER) {
    const c = cols[key];
    columns[key] = {
      color: COLUMN_COLOR_NAMES[key],
      visible: true,
      ...c,
    };
    column_labels[key] = c.label;
  }
  return { ...meta, id, columns, column_labels };
}

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  makePreset(
    "estetica",
    {
      title: "Estética & Belleza",
      category: "Belleza",
      emoji: "💅",
      description:
        "Flujo para salones, peluquerías y centros de estética. Desde la cita confirmada hasta el cobro y fidelización.",
      hint: "Cada columna representa una etapa del recorrido de tu clienta, desde que llega hasta que vuelve.",
    },
    {
      new:               { label: "Citas de hoy",       description: "Clientes con cita confirmada para hoy. Se mueven cuando llegan al local.",                icon: "today",            hint: "Alimentada automáticamente con citas del día" },
      qualified:         { label: "Por llegar",         description: "Clientes que deberían estar llegando en los próximos 20–30 minutos.",                     icon: "directions_walk",  hint: "Revisá la franja horaria próxima" },
      meeting_scheduled: { label: "En atención",        description: "Clienta está siendo atendida por una profesional en este momento.",                       icon: "person_check",     hint: "Activas ahora en el panel de atención" },
      data_received:     { label: "Servicio terminado", description: "El servicio finalizó. Pendiente cobro y cierre del ticket.",                              icon: "done_all",         hint: "Listas para cobrar — cerrá desde el panel" },
      sold:              { label: "Cobrado",            description: "Pago registrado. Ticket listo para archivar o programar próxima cita.",                   icon: "payments",         hint: "Completadas y cobradas" },
      follow_up:         { label: "Reagendar",          description: "Clienta pidió turno o necesita ser contactada para reagendar.",                           icon: "event_repeat",     hint: "Agendá el próximo turno" },
      no_response:       { label: "No asistió",         description: "La clienta no se presentó. Evaluar contacto o baja de la cita.",                          icon: "person_off",       hint: "Considerar reprogramar o contactar" },
      closed:            { label: "Archivado",          description: "Proceso cerrado. Historial disponible en la ficha del cliente.",                          icon: "archive",          hint: "Historial completo" },
    }
  ),
  makePreset(
    "spa",
    {
      title: "Spa & Masajes",
      category: "Bienestar",
      emoji: "🧘",
      description:
        "Diseñado para spas, centros de masajes y bienestar. Gestión de cabinas, check-in y feedback post-servicio.",
      hint: "Del check-in al feedback: cada etapa cuida la experiencia de tu huésped.",
    },
    {
      new:               { label: "Reserva confirmada", description: "Cliente tiene reserva activa para hoy.",                                                  icon: "spa",              hint: "Reservas de hoy confirmadas" },
      qualified:         { label: "Check-in recepción", description: "Cliente llegó y está en recepción completando el formulario de bienvenida.",              icon: "login",            hint: "Registrar llegada" },
      meeting_scheduled: { label: "Cabina activa",      description: "Sesión en progreso en la cabina asignada.",                                               icon: "hot_tub",          hint: "Sesiones activas ahora" },
      data_received:     { label: "Finalizando",        description: "Servicio terminado. Cliente en área de relajación post-tratamiento.",                     icon: "self_improvement", hint: "Preparar cobro" },
      sold:              { label: "Check-out cobrado",  description: "Pago completado. Cliente salió satisfecho.",                                              icon: "check_circle",     hint: "Cerrar sesión" },
      follow_up:         { label: "Feedback pendiente", description: "Enviar encuesta de satisfacción o llamar para fidelizar.",                                icon: "rate_review",      hint: "Pedir reseña o programar próxima visita" },
      no_response:       { label: "Canceló / No vino",  description: "El cliente canceló o no se presentó.",                                                   icon: "cancel",           hint: "Considerar reprogramar" },
      closed:            { label: "Archivado",          description: "Historial guardado en la ficha del cliente.",                                             icon: "archive",          hint: "Historial completo" },
    }
  ),
  makePreset(
    "barberia",
    {
      title: "Barbería",
      category: "Belleza",
      emoji: "✂️",
      description:
        "Flujo ágil para barberías con lista de espera, sillón activo y cobro rápido.",
      hint: "De la fila al sillón: gestión express del flujo de clientes.",
    },
    {
      new:               { label: "En la fila hoy",    description: "Clientes con turno para hoy esperando ser llamados.",                                      icon: "queue",            hint: "Próximos en atender" },
      qualified:         { label: "Llamado",           description: "Cliente fue llamado y se está acomodando en el sillón.",                                   icon: "record_voice_over",hint: "Llamar al siguiente" },
      meeting_scheduled: { label: "En el sillón",      description: "Corte o servicio en progreso activamente.",                                                icon: "content_cut",      hint: "Activos ahora" },
      data_received:     { label: "Terminado",         description: "Servicio listo. Mostrar al cliente el resultado y confirmar satisfacción.",                icon: "thumb_up",         hint: "Verificar con el cliente" },
      sold:              { label: "Cobrado",           description: "Pago recibido. Agradecer y despedir.",                                                     icon: "point_of_sale",    hint: "Ticket cerrado" },
      follow_up:         { label: "Vuelve pronto",     description: "Cliente frecuente: programar próximo turno o enviar recordatorio.",                        icon: "loyalty",          hint: "Fidelizar cliente" },
      no_response:       { label: "No vino",           description: "No se presentó al turno. Contactar si es cliente frecuente.",                              icon: "person_off",       hint: "Evaluar contacto" },
      closed:            { label: "Archivado",         description: "Historial de servicio guardado.",                                                          icon: "archive",          hint: "Historial completo" },
    }
  ),
  makePreset(
    "salud",
    {
      title: "Clínica & Salud",
      category: "Salud",
      emoji: "🏥",
      description:
        "Para clínicas, consultorios y centros de salud. Seguimiento clínico desde la solicitud hasta el alta.",
      hint: "Cada columna refleja el recorrido clínico del paciente.",
    },
    {
      new:               { label: "Solicitud",         description: "Nuevo paciente o consulta ingresada. Pendiente de evaluación inicial.",                    icon: "add_circle",       hint: "Nuevas solicitudes de atención" },
      qualified:         { label: "Pre-consulta",      description: "Paciente en sala de espera, datos verificados y anamnesis completada.",                    icon: "assignment_ind",   hint: "Listos para pasar a consulta" },
      meeting_scheduled: { label: "En consulta",       description: "Profesional de salud atendiendo al paciente en este momento.",                             icon: "stethoscope",      hint: "Consultas activas" },
      data_received:     { label: "Exámenes / Datos",  description: "Pendiente de resultados de exámenes, imágenes o información adicional.",                   icon: "lab_research",     hint: "Esperando resultados" },
      sold:              { label: "Tratamiento",       description: "Diagnóstico entregado. Paciente en tratamiento o con indicaciones.",                       icon: "medication",       hint: "En tratamiento activo" },
      follow_up:         { label: "Control",           description: "Paciente debe volver a control. Coordinar fecha de seguimiento.",                          icon: "event_available",  hint: "Agendar control" },
      no_response:       { label: "No asistió",        description: "El paciente no se presentó a la cita. Intentar contacto.",                                 icon: "person_off",       hint: "Contactar paciente" },
      closed:            { label: "Alta / Finalizado", description: "Paciente dado de alta o proceso clínico cerrado.",                                         icon: "verified",         hint: "Proceso cerrado" },
    }
  ),
  makePreset(
    "retail",
    {
      title: "Retail & Pedidos",
      category: "Comercio",
      emoji: "🛍️",
      description:
        "Para tiendas, boutiques y negocios con pedidos. Desde el pedido hasta la entrega y postventa.",
      hint: "Del pedido a la entrega: gestión del flujo operativo del local.",
    },
    {
      new:               { label: "Pedido nuevo",         description: "Pedido recibido. Pendiente de confirmación de stock y disponibilidad.",                 icon: "shopping_bag",     hint: "Nuevos pedidos a confirmar" },
      qualified:         { label: "Confirmado",           description: "Stock disponible. Pedido confirmado y en cola de preparación.",                         icon: "verified",         hint: "Listos para preparar" },
      meeting_scheduled: { label: "En preparación",       description: "Pedido siendo armado o producto siendo preparado para entrega.",                        icon: "inventory",        hint: "En preparación activa" },
      data_received:     { label: "Listo para entrega",   description: "Pedido listo. Esperando retiro del cliente o inicio de despacho.",                      icon: "package_2",        hint: "Avisar al cliente" },
      sold:              { label: "Entregado / Cobrado",  description: "Pedido entregado y pago confirmado.",                                                   icon: "local_shipping",   hint: "Completado" },
      follow_up:         { label: "Postventa",            description: "Contactar al cliente para verificar satisfacción o gestionar devolución.",               icon: "support_agent",    hint: "Seguimiento postventa" },
      no_response:       { label: "Cliente no responde",  description: "No se pudo contactar al cliente para coordinar entrega.",                                icon: "phone_disabled",   hint: "Intentar por otro canal" },
      closed:            { label: "Archivado",            description: "Pedido cerrado y registrado en historial.",                                             icon: "archive",          hint: "Historial completo" },
    }
  ),
  makePreset(
    "sales",
    {
      title: "Ventas & CRM",
      category: "Ventas",
      emoji: "📈",
      description:
        "Embudo de ventas clásico para negocios con leads, propuestas y cierre comercial.",
      hint: "Cada columna es una etapa del pipeline de ventas.",
    },
    {
      new:               { label: "Lead nuevo",          description: "Prospecto nuevo ingresado al sistema. Pendiente de primer contacto.",                    icon: "person_add",       hint: "Asignar y contactar" },
      qualified:         { label: "Calificado",          description: "Lead verificado con interés real. Listo para avanzar en el proceso.",                    icon: "star",             hint: "Agendar presentación" },
      meeting_scheduled: { label: "Reunión agendada",    description: "Presentación o demo programada con el potencial cliente.",                               icon: "calendar_month",   hint: "Preparar material" },
      data_received:     { label: "Propuesta enviada",   description: "Cotización o propuesta formal enviada. Esperando respuesta.",                            icon: "description",      hint: "Hacer seguimiento" },
      sold:              { label: "Ganado",              description: "Negocio cerrado. Contrato firmado o pago recibido.",                                      icon: "emoji_events",     hint: "¡Felicidades!" },
      follow_up:         { label: "Seguimiento",         description: "Cliente en negociación o requiere acompañamiento adicional.",                            icon: "follow_the_signs", hint: "Mantener contacto activo" },
      no_response:       { label: "Sin respuesta",       description: "No hubo respuesta tras múltiples intentos. Considerar descarte.",                        icon: "phone_missed",     hint: "Último intento de contacto" },
      closed:            { label: "Cerrado",             description: "Oportunidad cerrada (ganada o perdida). Historial guardado.",                            icon: "lock",             hint: "Archivado" },
    }
  ),
  makePreset(
    "support",
    {
      title: "Soporte & Mesa de ayuda",
      category: "Servicio",
      emoji: "🎧",
      description:
        "Para equipos de soporte técnico, atención al cliente o help desk.",
      hint: "Tickets del más urgente al resuelto — priorizá el color rojo.",
    },
    {
      new:               { label: "Nuevo ticket",        description: "Solicitud recién ingresada, sin asignar aún.",                                           icon: "confirmation_number", hint: "Asignar inmediatamente" },
      qualified:         { label: "En análisis",         description: "Ticket asignado y siendo diagnosticado por el equipo.",                                  icon: "manage_search",    hint: "Diagnóstico en progreso" },
      meeting_scheduled: { label: "Escalado / Llamada",  description: "Requiere intervención superior o llamada con el cliente.",                               icon: "support_agent",    hint: "Coordinación requerida" },
      data_received:     { label: "Info recibida",       description: "Datos, accesos o información del cliente recibida. En resolución.",                      icon: "inbox",            hint: "Resolver con la información" },
      sold:              { label: "Resuelto",            description: "Problema solucionado. Esperando confirmación del cliente.",                              icon: "task_alt",         hint: "Confirmar con cliente" },
      follow_up:         { label: "Pendiente cliente",   description: "Solución entregada, esperando acción o confirmación del cliente.",                       icon: "pending_actions",  hint: "Recordatorio al cliente" },
      no_response:       { label: "Sin respuesta",       description: "El cliente no respondió al contacto ni confirmó la resolución.",                         icon: "mark_email_unread",hint: "Cerrar si no hay respuesta en 48h" },
      closed:            { label: "Cerrado",             description: "Ticket completamente resuelto y cerrado.",                                               icon: "done",             hint: "Ticket archivado" },
    }
  ),
  makePreset(
    "generic",
    {
      title: "Genérico",
      category: "General",
      emoji: "⚙️",
      description:
        "Nombres neutros para cualquier proceso. Personalizá cada columna a tu gusto.",
      hint: "Descripción libre — ajustá cada columna en el diseñador.",
    },
    {
      new:               { label: "Nuevo",               description: "Item recién creado, sin procesar.",                                                      icon: "fiber_new",        hint: "Pendiente de acción" },
      qualified:         { label: "Calificado",          description: "Revisado y listo para avanzar.",                                                         icon: "check_small",      hint: "En progreso" },
      meeting_scheduled: { label: "Programado",          description: "Próxima acción programada.",                                                             icon: "event",            hint: "Acción próxima" },
      data_received:     { label: "En proceso",          description: "Siendo trabajado activamente.",                                                          icon: "autorenew",        hint: "Activo" },
      sold:              { label: "Completado",          description: "Tarea o proceso finalizado con éxito.",                                                  icon: "done_all",         hint: "Finalizado" },
      follow_up:         { label: "Seguimiento",         description: "Requiere acción de seguimiento posterior.",                                               icon: "update",           hint: "Revisar" },
      no_response:       { label: "Sin respuesta",       description: "Sin actividad o respuesta pendiente.",                                                   icon: "hourglass_empty",  hint: "Evaluar cierre" },
      closed:            { label: "Cerrado",             description: "Proceso cerrado y archivado.",                                                           icon: "lock",             hint: "Archivado" },
    }
  ),
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function presetById(id: string | undefined): WorkflowPreset {
  const p = WORKFLOW_PRESETS.find((x) => x.id === id);
  return p ?? WORKFLOW_PRESETS.find((x) => x.id === "generic")!;
}

export interface OperationsSettings {
  preset?: string;
  workflow_notes?: string;
  column_labels?: Partial<Record<string, string>>;
  column_descriptions?: Partial<Record<string, string>>;
  column_icons?: Partial<Record<string, string>>;
  column_colors?: Partial<Record<string, string>>;
  column_visible?: Partial<Record<string, boolean>>;
  wizard_version?: number;
}

export function getKanbanColumns(settings: { operations?: OperationsSettings } | null | undefined): {
  id: KanbanColumnId;
  label: string;
  description: string;
  icon: string;
  color: string;
  visible: boolean;
  hint: string;
}[] {
  const ops = settings?.operations;
  const preset = presetById(ops?.preset);
  const overrideLabels = ops?.column_labels || {};
  const overrideDescs  = ops?.column_descriptions || {};
  const overrideIcons  = ops?.column_icons || {};
  const overrideColors = ops?.column_colors || {};
  const overrideVis    = ops?.column_visible || {};

  return KANBAN_COLUMN_ORDER.map((id) => {
    const pc = preset.columns[id];
    const colorKey = overrideColors[id] ?? pc.color;
    return {
      id,
      label:       overrideLabels[id] ?? pc.label ?? DEFAULT_LABELS[id],
      description: overrideDescs[id]  ?? pc.description ?? "",
      icon:        overrideIcons[id]  ?? pc.icon ?? "label",
      color:       COLUMN_COLORS[colorKey] ?? COLUMN_COLORS["slate"],
      visible:     overrideVis[id]    ?? pc.visible ?? true,
      hint:        pc.hint ?? "",
    };
  }).filter((c) => c.visible);
}

export const WIZARD_HELP_TEXT = {
  title: "Flujos de trabajo personalizados",
  body:
    "Elegí una plantilla que se adapte a tu negocio y personalizá cada columna: nombre, descripción, color e ícono. Tu equipo arrastrará tarjetas entre columnas para avanzar el estado de cada cliente o pedido.",
};

export const PRESET_CATEGORIES = Array.from(
  new Set(WORKFLOW_PRESETS.map((p) => p.category))
);
