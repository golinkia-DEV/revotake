"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Building2, Package, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { getStoreId } from "@/lib/store";

interface BranchReport {
  branch_id: string;
  branch_name: string;
  region: string | null;
  comuna: string | null;
  total_units: number;
  inventory_value: number;
  sales_count_30d: number;
  revenue_30d: number;
  critical_products: number;
}

function fmtCLP(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function StatBadge({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className={`rounded-xl p-3 text-center ${accent ?? "bg-slate-50 dark:bg-slate-900/40"}`}>
      <p className="text-lg font-extrabold text-on-surface">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default function ProductsSedesPage() {
  const [storeId, setStoreId] = useState<string | null>(null);
  useEffect(() => setStoreId(getStoreId()), []);

  const { data, isLoading } = useQuery({
    queryKey: ["products-branch-report", storeId],
    queryFn: () => api.get<{ branches: BranchReport[]; period_days: number }>("/products/branch-report").then((r) => r.data),
    enabled: !!storeId,
  });

  const branches = data?.branches ?? [];
  const totalUnits = branches.reduce((s, b) => s + b.total_units, 0);
  const totalValue = branches.reduce((s, b) => s + b.inventory_value, 0);
  const totalRevenue = branches.reduce((s, b) => s + b.revenue_30d, 0);
  const totalSales = branches.reduce((s, b) => s + b.sales_count_30d, 0);

  return (
    <AppLayout>
      <div className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">Inventario</p>
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-on-surface">Stock por sede</h1>
        <p className="max-w-xl text-sm text-slate-500">
          Resumen de unidades, valor de inventario y ventas de los últimos 30 días por sucursal.
        </p>
        <div className="mt-3 flex gap-4 text-sm font-semibold text-primary">
          <Link href="/products" className="hover:underline">← Todos los productos</Link>
        </div>
      </div>

      {!storeId && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Seleccioná una tienda para ver el reporte.
        </p>
      )}

      {isLoading && storeId && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && storeId && branches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-500">Esta tienda no tiene sedes configuradas todavía.</p>
          <Link href="/scheduling/sedes" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">
            Crear primera sede →
          </Link>
        </div>
      )}

      {branches.length > 0 && (
        <>
          {/* Totales globales */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4"
          >
            <StatBadge label="Unidades totales" value={totalUnits.toLocaleString("es-CL")} accent="bg-blue-50 dark:bg-blue-950/30" />
            <StatBadge label="Valor inventario" value={fmtCLP(totalValue)} accent="bg-emerald-50 dark:bg-emerald-950/30" />
            <StatBadge label={`Ventas (${data?.period_days}d)`} value={totalSales} accent="bg-violet-50 dark:bg-violet-950/30" />
            <StatBadge label={`Ingresos (${data?.period_days}d)`} value={fmtCLP(totalRevenue)} accent="bg-amber-50 dark:bg-amber-950/30" />
          </motion.div>

          {/* Cards por sede */}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {branches.map((b, i) => (
              <motion.div
                key={b.branch_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-5"
              >
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="font-bold text-on-surface">{b.branch_name}</h2>
                    </div>
                    {(b.region || b.comuna) && (
                      <p className="mt-1 pl-11 text-xs text-slate-500">
                        {[b.comuna, b.region].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  {b.critical_products > 0 && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-300">
                      <AlertTriangle className="h-3 w-3" /> {b.critical_products} crítico{b.critical_products > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                    <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <Package className="h-3.5 w-3.5" /> Stock
                    </div>
                    <p className="text-xl font-extrabold text-on-surface">{b.total_units.toLocaleString("es-CL")}</p>
                    <p className="text-xs text-slate-400">unidades</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                    <div className="mb-1 text-xs font-semibold text-slate-500">Valor inventario</div>
                    <p className="text-xl font-extrabold text-on-surface">{fmtCLP(b.inventory_value)}</p>
                    <p className="text-xs text-slate-400">al precio de catálogo</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
                    <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Ventas {data?.period_days}d
                    </div>
                    <p className="text-xl font-extrabold text-on-surface">{b.sales_count_30d}</p>
                    <p className="text-xs text-slate-400">transacciones</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
                    <div className="mb-1 text-xs font-semibold text-slate-500">Ingresos {data?.period_days}d</div>
                    <p className="text-xl font-extrabold text-on-surface">{fmtCLP(b.revenue_30d)}</p>
                    <p className="text-xs text-slate-400">ventas registradas</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
}
