"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Kanban, AlertTriangle, Calendar, TrendingUp, ArrowRight, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getStoreId } from "@/lib/store";

function moneyCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(
    Math.round(n || 0),
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accentClass,
  href,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  accentClass: string;
  href?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="glass-card-hover p-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-1 text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-extrabold tracking-tight sm:text-3xl text-on-surface">{value ?? "—"}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accentClass}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
      {href && (
        <Link href={href} className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          Ver detalles <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: stats } = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => api.get("/dashboard/stats").then((r) => r.data) });

  const { data: panelData } = useQuery({
    queryKey: ["scheduling-panel", storeId],
    queryFn: () => api.get("/scheduling/panel").then((r) => r.data),
    enabled: !!storeId,
  });

  const { data: reportData } = useQuery({
    queryKey: ["suppliers-report", fromDate, toDate],
    queryFn: () => api.get("/products/suppliers/report", { params: { from_date: fromDate, to_date: toDate } }).then((r) => r.data),
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

  const bySupplier = reportData?.by_supplier ?? [];
  const barData = useMemo(
    () =>
      bySupplier.map((x: { supplier_name: string; amount_total: number; purchases_count: number }) => ({
        name: x.supplier_name,
        total: x.amount_total,
        compras: x.purchases_count,
      })),
    [bySupplier],
  );
  const lineData = reportData?.timeline ?? [];
  const summary = reportData?.summary ?? {};

  return (
    <AppLayout>
      <section className="mb-8">
        <div className="mb-6 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl text-on-surface">Panel principal</h1>
            <p className="text-lg text-on-surface-variant">Resumen de operaciones de tu tienda activa.</p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-slate-100 bg-white px-4 py-2 shadow-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">Sistema activo</span>
          </div>
        </div>

        <div className="relative mt-6 flex flex-col gap-5 overflow-hidden rounded-2xl border border-tertiary/10 bg-gradient-to-r from-tertiary/10 to-primary/5 p-6 md:flex-row md:items-start">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-tertiary/10 blur-3xl" />
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tertiary text-white shadow-lg shadow-tertiary/20">
            <MaterialIcon name="auto_awesome" className="text-2xl" filled />
          </div>
          <div className="relative flex-1">
            <h2 className="mb-1 flex flex-wrap items-center gap-2 font-bold text-tertiary">
              Sugerencia inteligente
              <span className="rounded-full bg-tertiary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">IA</span>
            </h2>
            <p className="max-w-2xl leading-relaxed text-on-surface">
              Revisa el inventario y la agenda: los datos de clientes y stock se actualizan según la tienda seleccionada.
            </p>
          </div>
          <Link href="/products" className="relative shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg hover:shadow-primary/20">
            Ver inventario
          </Link>
        </div>
      </section>

      <div className="bento-grid mb-8">
        <div className="col-span-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Clientes totales"
            value={stats?.total_clients}
            icon={Users}
            accentClass="bg-gradient-to-br from-primary to-primary-container"
            href="/clients"
          />
          <StatCard label="Tickets abiertos" value={stats?.open_tickets} icon={Kanban} accentClass="bg-tertiary" href="/kanban" />
          <StatCard label="Stock crítico" value={stats?.critical_stock_alerts} icon={AlertTriangle} accentClass="bg-error" href="/products" />
          <StatCard label="Stock bajo" value={stats?.low_stock_alerts} icon={AlertTriangle} accentClass="bg-amber-500" href="/products" />
          <StatCard
            label="Reuniones (7 días)"
            value={stats?.upcoming_meetings_7d}
            icon={Calendar}
            accentClass="bg-secondary"
            href="/calendar"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="glass-card p-8">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-on-surface">Actividad reciente</h2>
          </div>
          <p className="text-sm text-slate-500">Conecta métricas en tiempo real cuando el backend las exponga.</p>
        </div>
        <div className="glass-card p-8">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-on-surface">Próximas reuniones</h2>
          </div>
          <Link href="/calendar" className="btn-primary inline-flex text-sm">
            Abrir agenda <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <section className="mt-10 border-t border-slate-200 pt-10 dark:border-slate-800">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">Visualizaciones</p>
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-on-surface">
              <BarChart3 className="h-6 w-6 text-primary" />
              Gráficos del panel
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Todos los gráficos de la aplicación se concentran aquí. La agenda y proveedores enlazan a esta sección cuando aplica.
            </p>
          </div>
        </div>

        {!storeId ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            Seleccioná una tienda para cargar los gráficos.
          </p>
        ) : (
          <div className="space-y-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50"
            >
              <h3 className="mb-1 text-lg font-bold text-on-surface">Rendimiento de trabajadoras (90 días)</h3>
              <p className="mb-4 text-sm text-slate-500">Citas, ingresos estimados (miles CLP) y clientas fijas por profesional.</p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={staffChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <ReTooltip />
                    <Legend />
                    <Bar dataKey="citas" name="Citas" fill="#3b82f6" />
                    <Bar dataKey="ingresos" name="Ingresos (miles CLP)" fill="#22c55e" />
                    <Bar dataKey="fijas" name="Clientas fijas" fill="#a855f7" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Datos del panel de atención.{" "}
                <Link href="/calendar" className="font-semibold text-primary hover:underline">
                  Ir a agenda
                </Link>
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Compras a proveedores</h3>
                  <p className="text-sm text-slate-500">Período del reporte (mismos datos que en la página Proveedores).</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Desde</label>
                    <input type="date" className="input-field" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Hasta</label>
                    <input type="date" className="input-field" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Total comprado</p>
                    <p className="text-lg font-bold text-on-surface">{moneyCLP(summary.amount_total || 0)}</p>
                    <p className="text-xs text-slate-500">
                      {summary.purchases_count || 0} compras · {summary.suppliers_with_purchases || 0} proveedores
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  <h4 className="mb-3 font-semibold text-on-surface">Compras por proveedor</h4>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <ReTooltip formatter={(value) => moneyCLP(Number(value))} />
                        <Legend />
                        <Bar dataKey="total" name="Total comprado" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  <h4 className="mb-3 font-semibold text-on-surface">Histórico (línea de tiempo)</h4>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <ReTooltip formatter={(value) => moneyCLP(Number(value))} />
                        <Legend />
                        {(reportData?.timeline_keys ?? []).slice(0, 6).map((k: string, idx: number) => (
                          <Line
                            key={k}
                            dataKey={k}
                            stroke={["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4"][idx % 6]}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm">
                <Link href="/proveedores" className="font-semibold text-primary hover:underline">
                  Gestionar proveedores y tablas detalladas
                </Link>
              </p>
            </motion.div>
          </div>
        )}
      </section>
    </AppLayout>
  );
}
