"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Users,
  BarChart3,
  RefreshCcw,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import clsx from "clsx";

const PERIOD_OPTIONS = [
  { label: "7 días", value: 7 },
  { label: "30 días", value: 30 },
  { label: "90 días", value: 90 },
  { label: "365 días", value: 365 },
];

const PIE_COLORS = ["#10b981", "#7c3aed", "#f59e0b", "#f43f5e"];

function fmt_clp(cents: number) {
  const pesos = Math.round(cents / 100);
  if (pesos >= 1_000_000) return `$${(pesos / 1_000_000).toFixed(1)}M`;
  if (pesos >= 1_000) return `$${(pesos / 1_000).toFixed(0)}K`;
  return `$${pesos.toLocaleString("es-CL")}`;
}

function KpiCard({
  label,
  value,
  subvalue,
  icon: Icon,
  color,
  bgColor,
  trend,
  delay = 0,
}: {
  label: string;
  value: string;
  subvalue?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  trend?: number | null;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`rounded-2xl bg-white border border-slate-100 shadow-sm p-5 border-t-[3px] ${color.replace("text-", "border-t-")}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bgColor}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        {trend != null && (
          <div
            className={clsx(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
              trend >= 0
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            )}
          >
            {trend >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
      {subvalue && <p className="mt-1 text-xs text-slate-400">{subvalue}</p>}
    </motion.div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-violet-100 bg-white p-3 shadow-lg text-xs">
      <p className="font-bold text-slate-700 mb-1">{label}</p>
      {payload.map((p: { color: string; name: string; value: number }) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.name.includes("$") || p.name === "Ingresos" ? fmt_clp(p.value * 100) : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-analytics", days],
    queryFn: () =>
      api.get(`/dashboard/analytics?days=${days}`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const s = data?.summary;

  // Datos para gráfico de área de ingresos (en miles de pesos)
  const revenueData = (data?.daily_revenue ?? []).map(
    (d: { date: string; revenue_cents: number }) => ({
      date: d.date.slice(5), // MM-DD
      Ingresos: Math.round(d.revenue_cents / 100),
    })
  );

  // Datos para gráfico de barras de citas
  const apptData = (data?.daily_appointments ?? []).map(
    (d: { date: string; completed: number; confirmed: number; cancelled: number }) => ({
      date: d.date.slice(5),
      Completadas: d.completed,
      Confirmadas: d.confirmed,
      Canceladas: d.cancelled,
    })
  );

  // Pie de distribución de estados
  const pieData = s
    ? [
        { name: "Completadas", value: s.completed },
        { name: "Confirmadas", value: s.confirmed },
        { name: "Canceladas", value: s.cancelled },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-1">
            Reportes
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ingresos, ocupación y retención de clientes de tu tienda.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={clsx(
                "rounded-full px-4 py-1.5 text-xs font-bold transition-all",
                days === opt.value
                  ? "bg-violet-600 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition-colors"
            title="Actualizar"
          >
            <RefreshCcw className={clsx("h-4 w-4", isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4 mb-8">
            <KpiCard
              label="Ingresos"
              value={fmt_clp(s?.revenue_cents ?? 0)}
              subvalue={`${days} días`}
              icon={DollarSign}
              color="text-emerald-600"
              bgColor="bg-emerald-50"
              trend={s?.revenue_pct_change ?? null}
              delay={0}
            />
            <KpiCard
              label="Citas totales"
              value={String(s?.total_appointments ?? 0)}
              subvalue={`${s?.completed ?? 0} completadas`}
              icon={Calendar}
              color="text-violet-600"
              bgColor="bg-violet-50"
              delay={0.05}
            />
            <KpiCard
              label="Clientes nuevos"
              value={String(s?.new_clients ?? 0)}
              subvalue={`${s?.returning_clients ?? 0} recurrentes`}
              icon={Users}
              color="text-sky-600"
              bgColor="bg-sky-50"
              delay={0.1}
            />
            <KpiCard
              label="Cancelaciones"
              value={`${s?.cancellation_rate ?? 0}%`}
              subvalue={`${s?.cancelled ?? 0} canceladas`}
              icon={BarChart3}
              color="text-rose-600"
              bgColor="bg-rose-50"
              delay={0.15}
            />
          </div>

          {/* Gráfico ingresos */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6 mb-6"
          >
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">
              Ingresos diarios (CLP)
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.floor(revenueData.length / 8) - 1)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Ingresos"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  fill="url(#gradRevenue)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#7c3aed" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Citas por día + Distribución */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="lg:col-span-2 rounded-2xl bg-white border border-slate-100 shadow-sm p-6"
            >
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">
                Citas por día
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={apptData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.max(0, Math.floor(apptData.length / 8) - 1)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar dataKey="Completadas" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="Confirmadas" fill="#7c3aed" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="Canceladas" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6"
            >
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">
                Distribución de estados
              </h2>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {pieData.map((d, i) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="text-slate-600">{d.name}</span>
                        </div>
                        <span className="font-bold text-slate-900">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 text-center pt-12">Sin citas en el período</p>
              )}
            </motion.div>
          </div>

          {/* Top servicios + Ocupación */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6"
            >
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">
                Top servicios
              </h2>
              <div className="space-y-3">
                {(data?.top_services ?? []).length === 0 ? (
                  <p className="text-sm text-slate-400">Sin datos</p>
                ) : (
                  (data?.top_services ?? []).map(
                    (svc: { service_id: string; name: string; bookings: number; revenue_cents: number }, i: number) => {
                      const maxBookings = data.top_services[0]?.bookings ?? 1;
                      const pct = Math.round((svc.bookings / maxBookings) * 100);
                      return (
                        <div key={svc.service_id}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700 truncate max-w-[180px]">
                              {i + 1}. {svc.name}
                            </span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-slate-400">{svc.bookings} citas</span>
                              <span className="text-xs font-bold text-emerald-600">
                                {fmt_clp(svc.revenue_cents)}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100">
                            <div
                              className="h-1.5 rounded-full bg-violet-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6"
            >
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">
                Ocupación por profesional
              </h2>
              <div className="space-y-3">
                {(data?.prof_occupancy ?? []).length === 0 ? (
                  <p className="text-sm text-slate-400">Sin datos</p>
                ) : (
                  (data?.prof_occupancy ?? []).map(
                    (prof: { professional_id: string; name: string; appointments: number }, i: number) => {
                      const maxAppts = data.prof_occupancy[0]?.appointments ?? 1;
                      const pct = Math.round((prof.appointments / maxAppts) * 100);
                      const initial = prof.name
                        .split(" ")
                        .slice(0, 2)
                        .map((w: string) => w[0])
                        .join("")
                        .toUpperCase();
                      return (
                        <div key={prof.professional_id} className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-rose-500 text-xs font-bold text-white">
                            {initial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-700 truncate">{prof.name}</span>
                              <span className="text-xs font-bold text-violet-600 shrink-0 ml-2">
                                {prof.appointments}
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-100">
                              <div
                                className="h-1.5 rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  background: `hsl(${260 - i * 20}, 70%, ${55 + i * 5}%)`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
