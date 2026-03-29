"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Package, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { useState } from "react";
import clsx from "clsx";

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

  const { data } = useQuery({ queryKey: ["products"], queryFn: () => api.get("/products/").then(r => r.data) });
  const { data: alerts } = useQuery({ queryKey: ["stock-alerts"], queryFn: () => api.get("/products/alerts").then(r => r.data) });

  const create = useMutation({
    mutationFn: (d: typeof form) => api.post("/products/", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setShowForm(false); toast.success("Producto creado"); },
  });

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Productos y Stock</h1>
          <p className="text-gray-400">Control inteligente de inventario</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo producto
        </button>
      </div>
      {alerts?.alerts?.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card border border-red-500/30 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-red-300">Alertas de stock</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.alerts.map((a: AlertItem) => (
              <span key={a.id} className={clsx("badge", a.stock_status === "critical" ? "badge-critical" : "badge-low")}>
                {a.name} — {a.stock} unidades ({a.days_of_stock?.toFixed(0) ?? "?"} dias)
              </span>
            ))}
          </div>
        </motion.div>
      )}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-6">
          <h2 className="font-semibold text-white mb-4">Nuevo producto</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="Nombre *" />
            <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} className="input-field" placeholder="SKU" />
            <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input-field" placeholder="Categoria" />
            <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: +e.target.value }))} className="input-field" placeholder="Precio" />
            <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: +e.target.value }))} className="input-field" placeholder="Stock inicial" />
            <input type="number" value={form.lead_time_days} onChange={e => setForm(f => ({ ...f, lead_time_days: +e.target.value }))} className="input-field" placeholder="Dias reposicion" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => create.mutate(form)} className="btn-primary">Crear</button>
            <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
          </div>
        </motion.div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data?.items?.map((p: ProductItem) => (
          <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-hover p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-600/50 to-teal-600/50 flex items-center justify-center">
                  <Package className="w-5 h-5 text-green-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{p.name}</h3>
                  {p.sku && <p className="text-xs text-gray-500">SKU: {p.sku}</p>}
                </div>
              </div>
              <span className={clsx("badge", p.stock_status === "critical" ? "badge-critical" : p.stock_status === "low" ? "badge-low" : "badge-ok")}>
                {p.stock_status}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Stock</span><span className="text-white font-semibold">{p.stock} u.</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Precio</span><span className="text-white">${p.price.toLocaleString("es-CL")}</span></div>
              {p.avg_daily_sales > 0 && <div className="flex justify-between"><span className="text-gray-400">Venta diaria prom.</span><span className="text-white">{p.avg_daily_sales.toFixed(1)} u.</span></div>}
              {p.days_of_stock != null && <div className="flex justify-between"><span className="text-gray-400">Dias de stock</span><span className={p.days_of_stock < 7 ? "text-red-400 font-semibold" : "text-white"}>{p.days_of_stock.toFixed(0)} dias</span></div>}
            </div>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
