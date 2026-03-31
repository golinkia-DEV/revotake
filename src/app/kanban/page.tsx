"use client";
import { useEffect, useState, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  Calendar, Workflow, Settings2, X, ExternalLink, User, Clock,
  AlertCircle, Tag, ChevronDown, SlidersHorizontal, Loader2,
} from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import clsx from "clsx";
import { getStoreId } from "@/lib/store";
import { getKanbanColumns, presetById } from "@/lib/operationsWorkflow";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

const PRIORITY_COLORS: Record<string, string> = {
  high:   "bg-red-50 text-red-800 border border-red-200",
  medium: "bg-amber-50 text-amber-800 border border-amber-200",
  low:    "bg-slate-100 text-slate-600 border border-slate-200",
};
const PRIORITY_LABELS: Record<string, string> = {
  high: "Alta", medium: "Media", low: "Baja",
};

interface TicketItem {
  id: string; title: string; type: string; status: string; priority: string;
  client_id: string | null; due_date: string | null; assigned_to: string | null;
  assignee_name?: string;
  extra_data?: { appointment_id?: string; list_price_cents?: number };
}

// ─── Ticket card ─────────────────────────────────────────────────────────────

const TicketCard = memo(function TicketCard({
  ticket, index, colHint, onOpen,
}: {
  ticket: TicketItem; index: number; colHint: string; onOpen: (t: TicketItem) => void;
}) {
  const isLinked = !!ticket.extra_data?.appointment_id;
  return (
    <Draggable draggableId={ticket.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={clsx(
            "mb-2 cursor-grab select-none rounded-2xl border-b border-slate-100 bg-surface-container-lowest p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
            snapshot.isDragging && "rotate-1 scale-105 shadow-xl shadow-primary/15"
          )}
          onClick={() => onOpen(ticket)}
        >
          <p className="mb-2 line-clamp-2 text-sm font-bold text-on-surface">{ticket.title}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium}`}>
              {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/40">{ticket.type}</span>
          </div>
          {isLinked && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-300">
              <Calendar className="h-3 w-3" /> Vinculada a cita
            </p>
          )}
          {ticket.due_date && (
            <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3 w-3" />
              {new Date(ticket.due_date).toLocaleDateString("es-CL")}
            </div>
          )}
          {ticket.assignee_name && (
            <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              <User className="h-3 w-3" />
              {ticket.assignee_name}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
});

// ─── Ticket detail panel ──────────────────────────────────────────────────────

function TicketDetailPanel({ ticket, columns, onClose, onStatusChange }: {
  ticket: TicketItem;
  columns: { id: string; label: string; icon: string; description: string }[];
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [newStatus, setNewStatus] = useState(ticket.status);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <h3 className="font-bold text-on-surface">Detalle del ticket</h3>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Title + priority */}
        <div>
          <div className="mb-2 flex items-start justify-between gap-2">
            <h4 className="text-base font-bold text-on-surface leading-snug">{ticket.title}</h4>
            <span className={clsx("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", PRIORITY_COLORS[ticket.priority] ?? PRIORITY_COLORS.medium)}>
              {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800">
              <Tag className="h-3 w-3" />{ticket.type}
            </span>
            {ticket.extra_data?.appointment_id && (
              <span className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                <Calendar className="h-3 w-3" /> Vinculado a cita
              </span>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Información</p>
          {ticket.assignee_name && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <User className="h-4 w-4 shrink-0" />
              <span><strong className="text-on-surface">Asignado:</strong> {ticket.assignee_name}</span>
            </div>
          )}
          {ticket.due_date && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Clock className="h-4 w-4 shrink-0" />
              <span><strong className="text-on-surface">Vence:</strong> {new Date(ticket.due_date).toLocaleDateString("es-CL")}</span>
            </div>
          )}
          {ticket.extra_data?.list_price_cents != null && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <MaterialIcon name="payments" className="text-base shrink-0" />
              <span><strong className="text-on-surface">Precio lista:</strong> {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(ticket.extra_data.list_price_cents)}</span>
            </div>
          )}
        </div>

        {/* Move to stage */}
        <div>
          <p className="mb-2 text-sm font-semibold text-on-surface">Mover a etapa</p>
          <div className="space-y-2">
            {columns.map((col) => (
              <button key={col.id} type="button"
                onClick={() => setNewStatus(col.id)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                  newStatus === col.id
                    ? "border-primary bg-primary/5 font-semibold text-primary"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                <MaterialIcon name={col.icon} className="text-base shrink-0 text-slate-400" />
                <div className="flex-1">
                  <span className="font-medium">{col.label}</span>
                  {col.description && <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1">{col.description}</p>}
                </div>
                {newStatus === col.id && <span className="h-2 w-2 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-slate-200 p-4 space-y-2 dark:border-slate-700">
        {ticket.extra_data?.appointment_id && (
          <Link href="/calendar" className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <Calendar className="h-4 w-4 text-primary" /> Ver en Agenda
          </Link>
        )}
        {newStatus !== ticket.status && (
          <button type="button"
            onClick={() => { onStatusChange(ticket.id, newStatus); onClose(); }}
            className="btn-primary w-full flex items-center justify-center gap-2">
            Mover a <strong>{columns.find((c) => c.id === newStatus)?.label ?? newStatus}</strong>
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function KanbanPage() {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [openTicket, setOpenTicket] = useState<TicketItem | null>(null);

  useEffect(() => setStoreId(getStoreId()), []);

  const { data: store } = useQuery({
    queryKey: ["store-detail", storeId],
    queryFn: () => api.get(`/stores/${storeId}`).then((r) => r.data),
    enabled: !!storeId,
  });
  const { data: meData } = useQuery({
    queryKey: ["auth-me", storeId],
    queryFn: () => api.get("/auth/me").then((r) => r.data),
    enabled: !!storeId,
  });

  const isAdmin = meData?.store_context?.member_role === "admin";
  const columns = getKanbanColumns(store?.settings);
  const allColumns = getKanbanColumns({ ...store?.settings, operations: { ...store?.settings?.operations, column_visible: undefined } });
  const ops = store?.settings?.operations as { preset?: string; workflow_notes?: string } | undefined;
  const presetHint = presetById(ops?.preset).hint;

  const { data: board, isLoading } = useQuery({
    queryKey: ["kanban"],
    queryFn: () => api.get("/tickets/kanban").then((r) => r.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/tickets/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kanban"] }); toast.success("Ticket actualizado"); },
  });

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    updateStatus.mutate({ id: result.draggableId, status: result.destination.droppableId });
  }

  // Filter tickets
  function filteredTickets(colId: string): TicketItem[] {
    const raw: TicketItem[] = board?.[colId] ?? [];
    return raw.filter((t) => {
      const okPri = filterPriority === "all" || t.priority === filterPriority;
      const okType = filterType === "all" || t.type === filterType;
      return okPri && okType;
    });
  }

  // Unique types across board
  const allTypes = Array.from(
    new Set(
      Object.values(board ?? {}).flat().map((t: unknown) => (t as TicketItem).type).filter(Boolean)
    )
  );

  const totalTickets = Object.values(board ?? {}).reduce((s: number, v) => s + (v as unknown[]).length, 0);
  const activeTickets = columns.reduce((s, c) => c.id !== "closed" ? s + (board?.[c.id]?.length ?? 0) : s, 0);

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Workspace</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-on-surface">Operaciones</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Arrastrá tickets entre columnas para avanzar el estado. Las etiquetas reflejan el flujo de tu negocio.
          </p>
          {presetHint && <p className="mt-1 text-sm text-slate-500 italic">{presetHint}</p>}
          {ops?.workflow_notes && (
            <p className="mt-2 text-sm italic text-slate-600 border-l-2 border-primary/30 pl-3 dark:text-slate-400">"{ops.workflow_notes}"</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {/* Stats pills */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
            <span className="font-bold text-on-surface">{activeTickets}</span>
            <span className="text-slate-500">activos</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
            <span className="font-bold text-on-surface">{totalTickets}</span>
            <span className="text-slate-500">total</span>
          </div>

          {/* Filters */}
          <button type="button" onClick={() => setShowFilters(!showFilters)}
            className={clsx("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
              showFilters ? "border-primary bg-primary/5 text-primary" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300")}>
            <SlidersHorizontal className="h-4 w-4" /> Filtros
            {(filterPriority !== "all" || filterType !== "all") && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">!</span>
            )}
          </button>

          {/* Workflow designer (admin only) */}
          {isAdmin && (
            <Link href="/operations/workflow"
              className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10">
              <Workflow className="h-4 w-4" /> Diseñar flujo
            </Link>
          )}
        </div>
      </div>

      {/* Filters panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="mb-5 flex flex-wrap gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Prioridad</label>
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="input-field py-1.5 text-sm">
                <option value="all">Todas</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Tipo de ticket</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-field py-1.5 text-sm">
                <option value="all">Todos</option>
                {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button type="button" onClick={() => { setFilterPriority("all"); setFilterType("all"); }} className="btn-ghost py-1.5 text-sm">
                Limpiar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Board */}
      {isLoading ? (
        <div className="flex justify-center py-20 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto pb-4" style={{ WebkitOverflowScrolling: "touch" }}>
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-3 md:gap-4" style={{ minWidth: `${columns.length * 264}px` }}>
              {columns.map((col) => {
                const tickets = filteredTickets(col.id);
                return (
                  <div key={col.id} className="w-64 flex-shrink-0">
                    {/* Column header */}
                    <div className={clsx("mb-3 rounded-2xl border-t-2 bg-surface-container-low/80 p-3", col.color)}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <MaterialIcon name={col.icon} className="text-base shrink-0 text-slate-500" />
                          <span className="truncate text-sm font-bold text-slate-800 dark:text-slate-200">{col.label}</span>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-900/60">
                          {tickets.length}
                        </span>
                      </div>
                      {col.description && (
                        <p className="mt-1.5 text-[10px] text-slate-500 leading-snug line-clamp-2 dark:text-slate-400">{col.description}</p>
                      )}
                      {col.hint && (
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-primary/70 dark:text-primary/60">
                          <AlertCircle className="h-3 w-3 shrink-0" />{col.hint}
                        </p>
                      )}
                    </div>

                    {/* Droppable */}
                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={clsx(
                            "kanban-column min-h-[min(60vh,480px)] rounded-3xl p-2 transition-colors",
                            snapshot.isDraggingOver ? "border border-primary/25 bg-primary/5" : "bg-surface-container-low/50"
                          )}
                        >
                          {tickets.map((ticket, i) => (
                            <TicketCard key={ticket.id} ticket={ticket} index={i} colHint={col.hint} onOpen={setOpenTicket} />
                          ))}
                          {provided.placeholder}

                          {tickets.length === 0 && !snapshot.isDraggingOver && (
                            <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-slate-400">
                              <MaterialIcon name={col.icon} className="mb-2 text-2xl opacity-20" />
                              <p>Arrastrá tickets aquí</p>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        </div>
      )}

      {/* Ticket detail panel */}
      <AnimatePresence>
        {openTicket && (
          <>
            <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpenTicket(null)} />
            <TicketDetailPanel
              ticket={openTicket}
              columns={allColumns}
              onClose={() => setOpenTicket(null)}
              onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
            />
          </>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
