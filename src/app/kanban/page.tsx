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
  { id: "new", label: "Nuevo", color: "border-blue-500/40" },
  { id: "qualified", label: "Calificado", color: "border-purple-500/40" },
  { id: "meeting_scheduled", label: "Reunion", color: "border-yellow-500/40" },
  { id: "data_received", label: "Datos recibidos", color: "border-cyan-500/40" },
  { id: "sold", label: "Vendido", color: "border-green-500/40" },
  { id: "follow_up", label: "Seguimiento", color: "border-orange-500/40" },
  { id: "no_response", label: "Sin respuesta", color: "border-rose-500/40" },
  { id: "closed", label: "Cerrado", color: "border-gray-500/40" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-300",
  medium: "bg-yellow-500/20 text-yellow-300",
  low: "bg-gray-500/20 text-gray-300",
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
        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
          className={clsx("glass-card p-3 mb-2 cursor-grab select-none transition-all", snapshot.isDragging && "shadow-xl shadow-brand-500/20 scale-105 rotate-1")}>
          <p className="text-sm font-medium text-white mb-2 line-clamp-2">{ticket.title}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium}`}>{ticket.priority}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-dark-500 text-gray-400">{ticket.type}</span>
          </div>
          {ticket.due_date && (
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
              <Calendar className="w-3 h-3" />
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
  const { data: board } = useQuery({ queryKey: ["kanban"], queryFn: () => api.get("/tickets/kanban").then(r => r.data) });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/tickets/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kanban"] }); toast.success("Ticket actualizado"); },
  });

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const ticketId = result.draggableId;
    const newStatus = result.destination.droppableId;
    updateStatus.mutate({ id: ticketId, status: newStatus });
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Tablero Kanban</h1>
          <p className="text-gray-400">Arrastra tickets entre columnas para actualizar su estado</p>
        </div>
      </div>
      <div className="overflow-x-auto pb-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4" style={{ minWidth: `${COLUMNS.length * 280}px` }}>
            {COLUMNS.map((col) => (
              <div key={col.id} className="w-64 flex-shrink-0">
                <div className={`glass-card border-t-2 ${col.color} p-3 mb-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{col.label}</span>
                    <span className="text-xs text-gray-500 bg-dark-600 px-2 py-0.5 rounded-full">
                      {board?.[col.id]?.length ?? 0}
                    </span>
                  </div>
                </div>
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}
                      className={clsx("min-h-40 rounded-xl p-2 transition-colors", snapshot.isDraggingOver ? "bg-brand-600/10 border border-brand-500/30" : "bg-transparent")}>
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
