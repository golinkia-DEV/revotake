"use client";
import { useEffect, useState, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  Calendar, Workflow, X, ExternalLink, User, Clock,
  Tag, ChevronDown, SlidersHorizontal, Loader2, Activity,
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

function Badge({ children, variant }: { children: React.ReactNode; variant: "emerald" | "amber" | "rose" | "blue" | "slate" | "purple" }) {
  const cls = {
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  }[variant];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

const PRIORITY_VARIANT: Record<string, "rose" | "amber" | "slate"> = {
  high: "rose",
  medium: "amber",
  low: "slate",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "Alta", medium: "Media", low: "Baja",
};

const PRIORITY_BORDER: Record<string, string> = {
  high: "border-l-rose-500",
  medium: "border-l-amber-500",
  low: "border-l-slate-300 dark:border-l-slate-600",
};

interface TicketItem {
  id: string; title: string; type: string; status: string; priority: string;
  client_id: string | null; due_date: string | null; assigned_to: string | null;
  assignee_name?: string;
  extra_data?: { appointment_id?: string; list_price_cents?: number };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days}d`;
  return `hace ${Math.floor(days / 7)}sem`;
}

// ─── Ticket card ─────────────────────────────────────────────────────────────

const TicketCard = memo(function TicketCard({
  ticket, index, onOpen,
}: {
  ticket: TicketItem; index: number; colHint?: string; onOpen: (t: TicketItem) => void;
}) {
  const isLinked = !!ticket.extra_data?.appointment_id;
  const priorityVariant = PRIORITY_VARIANT[ticket.priority] ?? "slate";
  const borderColor = PRIORITY_BORDER[ticket.priority] ?? PRIORITY_BORDER.low;

  return (
    <Draggable draggableId={ticket.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={clsx(
            "mb-2 cursor-grab select-none rounded-2xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900",
            borderColor,
            snapshot.isDragging && "rotate-1 scale-105 shadow-xl"
          )}
          onClick={() => onOpen(ticket)}
        >
          <p className="mb-3 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">{ticket.title}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={priorityVariant}>{PRIORITY_LABELS[ticket.priority] ?? ticket.priority}</Badge>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">{ticket.type}</span>
          </div>
          {isLinked && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400">
              <Calendar className="h-3 w-3" /> Vinculada a cita
            </p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            {ticket.assignee_name && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
                  <User className="h-3 w-3" />
                </div>
                <span className="truncate max-w-[80px]">{ticket.assignee_name}</span>
              </div>
            )}
            {ticket.due_date && (
              <div className="flex items-center gap-1 text-xs text-slate-400 ml-auto">
                <Clock className="h-3 w-3" />
                {timeAgo(ticket.due_date)}
              </div>
            )}
          </div>
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
  const priorityVariant = PRIORITY_VARIANT[ticket.priority] ?? "slate";

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
        <h3 className="font-bold text-slate-900 dark:text-white">Detalle del ticket</h3>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Title + priority */}
        <div>
          <div className="mb-2 flex items-start justify-between gap-2">
            <h4 className="text-base font-bold text-slate-900 dark:text-white leading-snug">{ticket.title}</h4>
            <Badge variant={priorityVariant}>{PRIORITY_LABELS[ticket.priority] ?? ticket.priority}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <Tag className="h-3 w-3" />{ticket.type}
            </span>
            {ticket.extra_data?.appointment_id && (
              <Badge variant="blue">Vinculado a cita</Badge>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Información</p>
          {ticket.assignee_name && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <User className="h-4 w-4 shrink-0" />
              <span><strong className="text-slate-900 dark:text-white">Asignado:</strong> {ticket.assignee_name}</span>
            </div>
          )}
          {ticket.due_date && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Clock className="h-4 w-4 shrink-0" />
              <span><strong className="text-slate-900 dark:text-white">Vence:</strong> {new Date(ticket.due_date).toLocaleDateString("es-CL")}</span>
            </div>
          )}
          {ticket.extra_data?.list_price_cents != null && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <MaterialIcon name="payments" className="text-base shrink-0" />
              <span><strong className="text-slate-900 dark:text-white">Precio lista:</strong> {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(ticket.extra_data.list_price_cents)}</span>
            </div>
          )}
        </div>

        {/* Move to stage */}
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Mover a etapa</p>
          <div className="space-y-2">
            {columns.map((col) => (
              <button key={col.id} type="button"
                onClick={() => setNewStatus(col.id)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                  newStatus === col.id
                    ? "border-blue-500 bg-blue-50 font-semibold text-blue-700 dark:border-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                <MaterialIcon name={col.icon} className="text-base shrink-0 text-slate-400" />
                <div className="flex-1">
                  <span className="font-medium">{col.label}</span>
                  {col.description && <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1">{col.description}</p>}
                </div>
                {newStatus === col.id && <span className="h-2 w-2 rounded-full bg-blue-600" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 p-4 space-y-2 dark:border-slate-700">
        {ticket.extra_data?.appointment_id && (
          <Link href="/calendar" className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <Calendar className="h-4 w-4 text-blue-600" /> Ver en Agenda <ExternalLink className="h-3 w-3 text-slate-400" />
          </Link>
        )}
        {newStatus !== ticket.status && (
          <button type="button"
            onClick={() => { onStatusChange(ticket.id, newStatus); onClose(); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-95"
          >
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

  const sc = meData?.store_context;
  const normalized = sc?.member_role_normalized;
  const rawRole = sc?.member_role;
  const isStoreAdmin =
    normalized === "store_admin" ||
    normalized === "branch_admin" ||
    rawRole === "admin" ||
    rawRole === "store_admin" ||
    rawRole === "seller" ||
    rawRole === "branch_admin";
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

  function filteredTickets(colId: string): TicketItem[] {
    const raw: TicketItem[] = board?.[colId] ?? [];
    return raw.filter((t) => {
      const okPri = filterPriority === "all" || t.priority === filterPriority;
      const okType = filterType === "all" || t.type === filterType;
      return okPri && okType;
    });
  }

  const allTypes = Array.from(
    new Set(Object.values(board ?? {}).flat().map((t: unknown) => (t as TicketItem).type).filter(Boolean))
  );

  const totalTickets = Object.values(board ?? {}).reduce((s: number, v) => s + (v as unknown[]).length, 0);
  const activeTickets = columns.reduce((s, c) => c.id !== "closed" ? s + (board?.[c.id]?.length ?? 0) : s, 0);

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Workspace</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Operaciones</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            Arrastra tickets entre columnas para avanzar el estado.
          </p>
          {presetHint && <p className="mt-1 text-sm italic text-slate-500 dark:text-slate-400">{presetHint}</p>}
          {ops?.workflow_notes && (
            <p className="mt-2 border-l-2 border-blue-300 pl-3 text-sm italic text-slate-600 dark:text-slate-400">"{ops.workflow_notes}"</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {/* Stats pills */}
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{activeTickets}</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-500">activos</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <span className="text-sm font-bold text-slate-900 dark:text-white">{totalTickets}</span>
            <span className="text-xs text-slate-500">total</span>
          </div>

          {/* Filters */}
          <button type="button" onClick={() => setShowFilters(!showFilters)}
            className={clsx("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
              showFilters ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950/30 dark:text-blue-400" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300")}>
            <SlidersHorizontal className="h-4 w-4" /> Filtros
            {(filterPriority !== "all" || filterType !== "all") && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">!</span>
            )}
          </button>

          {/* Workflow designer (admin only) */}
          {isStoreAdmin && (
            <Link href="/operations/workflow"
              className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50">
              <Workflow className="h-4 w-4" /> Disenar flujo
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
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Prioridad</label>
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="all">Todas</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipo de ticket</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="all">Todos</option>
                {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button type="button" onClick={() => { setFilterPriority("all"); setFilterType("all"); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Limpiar filtros
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Board */}
      {isLoading ? (
        <div className="flex justify-center py-20 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto pb-4" style={{ WebkitOverflowScrolling: "touch" }}>
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-3 md:gap-4" style={{ minWidth: `${columns.length * 268}px` }}>
              {columns.map((col) => {
                const tickets = filteredTickets(col.id);
                return (
                  <div key={col.id} className="w-64 flex-shrink-0">
                    {/* Column header */}
                    <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                            <MaterialIcon name={col.icon} className="text-sm text-slate-500 dark:text-slate-400" />
                          </div>
                          <span className="truncate text-sm font-bold text-slate-800 dark:text-slate-200">{col.label}</span>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {tickets.length}
                        </span>
                      </div>
                      {col.description && (
                        <p className="mt-1.5 text-[10px] leading-snug text-slate-500 line-clamp-2 dark:text-slate-400">{col.description}</p>
                      )}
                    </div>

                    {/* Droppable */}
                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={clsx(
                            "min-h-[min(60vh,480px)] rounded-3xl p-2 transition-colors",
                            snapshot.isDraggingOver
                              ? "border border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20"
                              : "bg-slate-50/80 dark:bg-slate-800/30"
                          )}
                        >
                          {tickets.map((ticket, i) => (
                            <TicketCard key={ticket.id} ticket={ticket} index={i} onOpen={setOpenTicket} />
                          ))}
                          {provided.placeholder}

                          {tickets.length === 0 && !snapshot.isDraggingOver && (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                              <Activity className="mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
                              <p className="text-xs text-slate-400 dark:text-slate-500">No hay tickets aqui</p>
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
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setOpenTicket(null)} />
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
