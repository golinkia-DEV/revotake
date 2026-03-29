"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import clsx from "clsx";

const COLUMNS: { id: string; label: string; color: string }[] = [
  { id: "new", label: "Nuevo", color: "border-blue-400" },
  { id: "qualified", label: "Calificado", color: "border-purple-400" },
  { id: "meeting_scheduled", label: "Reunión", color: "border-amber-400" },
  { id: "data_received", label: "Datos recibidos", color: "border-cyan-400" },
  { id: "sold", label: "Vendido", color: "border-emerald-400" },
  { id: "follow_up", label: "Seguimiento", color: "border-orange-400" },
  { id: "no_response", label: "Sin respuesta", color: "border-rose-400" },
  { id: "closed", label: "Cerrado", color: "border-slate-400" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-50 text-red-800 border border-red-200",
  medium: "bg-amber-50 text-amber-800 border border-amber-200",
  low: "bg-slate-100 text-slate-600 border border-slate-200",
};

interface TicketItem {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  client_id: string | null;
  due_date: string | null;
}

function TicketCard({ ticket, index }: { ticket: TicketItem; index: number }) {
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
        >
          <p className="mb-2 line-clamp-2 text-sm font-bold text-on-surface">{ticket.title}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium}`}>
              {ticket.priority}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">{ticket.type}</span>
          </div>
          {ticket.due_date && (
            <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="h-3 w-3" />
              {new Date(ticket.due_date).toLocaleDateString("es-CL")}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

export default function KanbanPage() {
  const qc = useQueryClient();
  const { data: board } = useQuery({ queryKey: ["kanban"], queryFn: () => api.get("/tickets/kanban").then((r) => r.data) });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/tickets/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban"] });
      toast.success("Ticket actualizado");
    },
  });

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const ticketId = result.draggableId;
    const newStatus = result.destination.droppableId;
    updateStatus.mutate({ id: ticketId, status: newStatus });
  }

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Workspace</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Operaciones</h1>
          <p className="mt-1 text-slate-500">Arrastra tickets entre columnas para actualizar su estado</p>
        </div>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex items-center gap-2 border border-slate-200 bg-white">
            Filtros
          </button>
        </div>
      </div>
      <div className="overflow-x-auto pb-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4" style={{ minWidth: `${COLUMNS.length * 280}px` }}>
            {COLUMNS.map((col) => (
              <div key={col.id} className="w-64 flex-shrink-0">
                <div className={clsx("mb-3 rounded-2xl border-t-2 bg-surface-container-low/80 p-3", col.color)}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">{col.label}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600 shadow-sm">
                      {board?.[col.id]?.length ?? 0}
                    </span>
                  </div>
                </div>
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
                      {(board?.[col.id] ?? []).map((ticket: TicketItem, i: number) => (
                        <TicketCard key={ticket.id} ticket={ticket} index={i} />
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </AppLayout>
  );
}
