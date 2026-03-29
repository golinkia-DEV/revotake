"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Package, AlertTriangle, TrendingUp } from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { useState } from "react";
import clsx from "clsx";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

interface ProductItem {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  stock_status: string;
  avg_daily_sales: number;
  days_of_stock: number | null;
  category: string | null;
}

interface AlertItem {
  id: string;
  name: string;
  stock: number;
  stock_status: string;
  days_of_stock: number | null;
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", sku: "", price: 0, stock: 0, lead_time_days: 3, category: "" });

  const { data } = useQuery({ queryKey: ["products"], queryFn: () => api.get("/products/").then((r) => r.data) });
  const { data: alerts } = useQuery({ queryKey: ["stock-alerts"], queryFn: () => api.get("/products/alerts").then((r) => r.data) });

  const criticalCount = alerts?.alerts?.filter((a: AlertItem) => a.stock_status === "critical").length ?? 0;
  const lowCount = alerts?.alerts?.filter((a: AlertItem) => a.stock_status === "low").length ?? 0;

  const create = useMutation({
    mutationFn: (d: typeof form) => api.post("/products/", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setShowForm(false);
      toast.success("Producto creado");
    },
  });

  return (
    <AppLayout>
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-2">Inventario</h1>
        <p className="text-slate-500">Control de stock y productos de la tienda activa.</p>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col justify-between rounded-2xl border border-transparent bg-surface-container-lowest p-6 shadow-sm transition-all hover:border-primary/10">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-xl bg-secondary-container p-3 text-on-secondary-container">
              <MaterialIcon name="check_circle" className="text-2xl" filled />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">Estado</span>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-500">Salud global</p>
            <h3 className="text-2xl font-bold text-on-surface">{criticalCount + lowCount === 0 ? "Óptimo" : "Atención"}</h3>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
            <div
              className="h-full rounded-full bg-secondary transition-all"
              style={{ width: `${Math.min(100, 100 - (criticalCount + lowCount) * 12)}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-2xl border border-transparent bg-surface-container-lowest p-6 shadow-sm transition-all hover:border-error/15">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-xl bg-error-container p-3 text-on-error-container">
              <MaterialIcon name="warning" className="text-2xl" filled />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-error">Crítico / bajo</span>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-500">Alertas activas</p>
            <h3 className="text-2xl font-bold text-on-surface">{(alerts?.alerts?.length as number) ?? 0}</h3>
          </div>
          <p className="mt-4 flex items-center gap-1 text-xs font-medium text-error">
            <MaterialIcon name="schedule" className="text-sm" />
            Revisa productos marcados abajo
          </p>
        </div>
        <div className="flex flex-col justify-between rounded-2xl border border-transparent bg-surface-container-lowest p-6 shadow-sm transition-all hover:border-tertiary/15">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-xl bg-tertiary-fixed p-3 text-on-tertiary-fixed">
              <MaterialIcon name="inventory_2" className="text-2xl" filled />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-tertiary">Catálogo</span>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-500">Productos</p>
            <h3 className="text-2xl font-bold text-on-surface">{data?.items?.length ?? 0}</h3>
          </div>
          <p className="mt-4 flex items-center gap-1 text-xs text-slate-500">
            <TrendingUp className="h-3.5 w-3.5" />
            SKU y stock en tiempo real
          </p>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-on-surface">Productos</h2>
        <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nuevo producto
        </button>
      </div>

      {alerts?.alerts?.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card mb-6 border border-red-200/80 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-900">Alertas de stock</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.alerts.map((a: AlertItem) => (
              <span key={a.id} className={clsx("badge", a.stock_status === "critical" ? "badge-critical" : "badge-low")}>
                {a.name} — {a.stock} u. ({a.days_of_stock?.toFixed(0) ?? "?"} días)
              </span>
            ))}
          </div>
        </motion.div>
      )}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card mb-6 p-6">
          <h2 className="mb-4 font-semibold text-on-surface">Nuevo producto</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input-field"
              placeholder="Nombre *"
            />
            <input
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              className="input-field"
              placeholder="SKU"
            />
            <input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="input-field"
              placeholder="Categoría"
            />
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: +e.target.value }))}
              className="input-field"
              placeholder="Precio"
            />
            <input
              type="number"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: +e.target.value }))}
              className="input-field"
              placeholder="Stock inicial"
            />
            <input
              type="number"
              value={form.lead_time_days}
              onChange={(e) => setForm((f) => ({ ...f, lead_time_days: +e.target.value }))}
              className="input-field"
              placeholder="Días reposición"
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => create.mutate(form)} className="btn-primary">
              Crear
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </motion.div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.items?.map((p: ProductItem) => (
          <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-hover p-5">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                  <Package className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <h3 className="font-semibold text-on-surface">{p.name}</h3>
                  {p.sku && <p className="text-xs text-slate-500">SKU: {p.sku}</p>}
                </div>
              </div>
              <span className={clsx("badge", p.stock_status === "critical" ? "badge-critical" : p.stock_status === "low" ? "badge-low" : "badge-ok")}>
                {p.stock_status}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Stock</span>
                <span className="font-semibold text-on-surface">{p.stock} u.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Precio</span>
                <span className="text-on-surface">${p.price.toLocaleString("es-CL")}</span>
              </div>
              {p.avg_daily_sales > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Venta diaria prom.</span>
                  <span className="text-on-surface">{p.avg_daily_sales.toFixed(1)} u.</span>
                </div>
              )}
              {p.days_of_stock != null && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Días de stock</span>
                  <span className={p.days_of_stock < 7 ? "font-semibold text-error" : "text-on-surface"}>{p.days_of_stock.toFixed(0)} días</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
