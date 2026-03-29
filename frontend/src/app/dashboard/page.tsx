"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Kanban, AlertTriangle, Calendar, TrendingUp, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import Link from "next/link";

function StatCard({ label, value, icon: Icon, color, href }: { label: string; value: number | undefined; icon: React.ElementType; color: string; href?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} className="glass-card-hover p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">{label}</p>
          <p className="text-4xl font-bold text-white">{value ?? "—"}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-4 transition-colors">
          Ver detalles <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  const { data: stats } = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => api.get("/dashboard/stats").then(r => r.data) });

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-gray-400">Resumen de operaciones</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Clientes totales" value={stats?.total_clients} icon={Users} color="bg-brand-600" href="/clients" />
        <StatCard label="Tickets abiertos" value={stats?.open_tickets} icon={Kanban} color="bg-purple-600" href="/kanban" />
        <StatCard label="Alertas de stock" value={stats?.critical_stock_alerts} icon={AlertTriangle} color="bg-red-600" href="/products" />
        <StatCard label="Reuniones (7 dias)" value={stats?.upcoming_meetings_7d} icon={Calendar} color="bg-green-600" href="/calendar" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-brand-400" />
            <h2 className="font-semibold text-white">Actividad reciente</h2>
          </div>
          <p className="text-gray-500 text-sm">Conecta con el backend para ver actividad en tiempo real.</p>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-brand-400" />
            <h2 className="font-semibold text-white">Proximas reuniones</h2>
          </div>
          <Link href="/calendar" className="btn-primary inline-flex items-center gap-2 text-sm">
            Ver calendario <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
