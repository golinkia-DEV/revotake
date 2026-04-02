"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, AlertTriangle, Calendar, TrendingUp, ArrowRight, BarChart3, Package, Activity } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  Legend,
} from "recharts";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import Link from "next/link";
import { getStoreId } from "@/lib/store";
import { DashboardAgendaHubToday } from "@/components/dashboard/DashboardAgendaHubToday";

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass,
  href,
  delay = 0,
}: {
  label: string;
  value: number | string | undefined;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  href?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4, transition: { duration: 0.15 } }}
      className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 border-t-[3px] ${colorClass.replace("text-", "border-t-").replace("-600", "-500").replace("-400", "-400")}`}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bgClass}`}>
          <Icon className={`h-6 w-6 ${colorClass}`} />
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-headline">{value ?? "—"}</p>
      {href && (
        <Link href={href} className="mt-3 flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400">
          Ver detalles <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  const storeId = typeof window !== "undefined" ? getStoreId() : null;

  const { data: me } = useQuery({
    queryKey: ["auth-me-dashboard"],
    queryFn: () => api.get("/auth/me").then((r) => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats").then((r) => r.data),
  });

  const { data: panelData } = useQuery({
    queryKey: ["scheduling-panel", storeId],
    queryFn: () => api.get("/scheduling/panel").then((r) => r.data),
    enabled: !!storeId,
  });

  const staffChartData = (panelData?.staff ?? []).map(
    (s: { name: string; appointments_count_90d: number; revenue_cents_completed_90d: number; fixed_clients_90d: number }) => ({
      name: s.name,
      citas: s.appointments_count_90d,
      ingresos: Math.round((s.revenue_cents_completed_90d || 0) / 1000),
      fijas: s.fixed_clients_90d || 0,
    }),
  );

  const firstName = me?.name?.split(" ")[0] ?? me?.email?.split("@")[0] ?? "usuario";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <AppLayout>
      {/* Header */}
      <section className="mb-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400 mb-1">Dashboard</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {greeting}, {firstName}
            </h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">Resumen de operaciones de tu tienda activa.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Sistema activo</span>
          </div>
        </div>
      </section>

      {/* KPI Grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Clientes totales"
          value={stats?.total_clients}
          icon={Users}
          colorClass="text-violet-600 dark:text-violet-400"
          bgClass="bg-violet-100 dark:bg-violet-900/30"
          href="/clients"
          delay={0}
        />
        <StatCard
          label="Tickets abiertos"
          value={stats?.open_tickets}
          icon={Activity}
          colorClass="text-amber-600 dark:text-amber-400"
          bgClass="bg-amber-100 dark:bg-amber-900/30"
          href="/kanban"
          delay={0.05}
        />
        <StatCard
          label="Stock crítico"
          value={stats?.critical_stock_alerts}
          icon={AlertTriangle}
          colorClass="text-rose-600 dark:text-rose-400"
          bgClass="bg-rose-100 dark:bg-rose-900/30"
          href="/products"
          delay={0.1}
        />
        <StatCard
          label="Reuniones (7 días)"
          value={stats?.upcoming_meetings_7d}
          icon={Calendar}
          colorClass="text-emerald-600 dark:text-emerald-400"
          bgClass="bg-emerald-100 dark:bg-emerald-900/30"
          href="/calendar"
          delay={0.15}
        />
      </div>

      {/* Agenda hoy */}
      {storeId && (
        <section className="mb-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">Hoy</p>
          <DashboardAgendaHubToday />
        </section>
      )}

      {/* Cards inferiores */}
      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Actividad reciente — empty state elegante */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <h2 className="font-bold text-slate-900 dark:text-white">Actividad reciente</h2>
          </div>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <Activity className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sin actividad reciente</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Las métricas en tiempo real aparecerán aquí cuando estén disponibles</p>
          </div>
        </div>

        {/* Agenda y citas */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <h2 className="font-bold text-slate-900 dark:text-white">Agenda y citas</h2>
          </div>
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20">
              <Calendar className="h-7 w-7 text-blue-500" />
            </div>
            <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">Calendario por profesional</p>
            <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">Reserva telefónica y gestión de reuniones</p>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-95"
            >
              Abrir agenda <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Gráfico de equipo */}
      <section className="border-t border-slate-200 pt-8 dark:border-slate-800">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">Visualizaciones</p>
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-white">
              <BarChart3 className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              Gráficos del panel
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Rendimiento del equipo en 90 días. Ver{" "}
              <Link href="/proveedores" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                Proveedores
              </Link>{" "}
              para compras.
            </p>
          </div>
        </div>

        {!storeId ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50 py-12 text-center dark:border-amber-900/50 dark:bg-amber-950/20">
            <Package className="mb-3 h-10 w-10 text-amber-400" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Selecciona una tienda</p>
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Los gráficos se cargarán según la tienda activa</p>
          </div>
        ) : staffChartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
            <BarChart3 className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Sin datos de rendimiento aún</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Los datos aparecerán cuando haya citas completadas</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50"
          >
            <h3 className="mb-1 text-base font-bold text-slate-900 dark:text-white">Rendimiento de trabajadoras (90 días)</h3>
            <p className="mb-4 text-sm text-slate-500">Citas, ingresos estimados (miles CLP) y clientas fijas por profesional.</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={staffChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ReTooltip />
                  <Legend />
                  <Bar dataKey="citas" name="Citas" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ingresos" name="Ingresos (miles CLP)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="fijas" name="Clientas fijas" fill="#EC4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              <Link href="/calendar" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                Ir a agenda
              </Link>{" "}
              para ver detalle por profesional.
            </p>
          </motion.div>
        )}
      </section>
    </AppLayout>
  );
}
