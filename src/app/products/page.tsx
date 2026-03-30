"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Package, AlertTriangle, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import clsx from "clsx";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getStoreId } from "@/lib/store";

interface BranchRef {
  id: string;
  name: string;
}

interface BranchStockRow {
  branch_id: string;
  branch_name: string;
  quantity: number;
  lead_time_days: number | null;
}

interface ProductItem {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  branch_stocks: BranchStockRow[];
  stock_status: string;
  avg_daily_sales: number;
  days_of_stock: number | null;
  category: string | null;
  lead_time_days: number;
}

interface AlertItem {
  id: string;
  name: string;
  stock: number;
  branch_stocks: BranchStockRow[];
  stock_status: string;
  days_of_stock: number | null;
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", sku: "", price: 0, stock: 0, lead_time_days: 3, category: "" });
  const [branchQty, setBranchQty] = useState<Record<string, number>>({});
  const [branchLead, setBranchLead] = useState<Record<string, string>>({});

  const { data: branchCtx } = useQuery({
    queryKey: ["products-branch-context", storeId],
    queryFn: () => api.get<{ items: BranchRef[] }>("/products/branch-context").then((r) => r.data),
    enabled: !!storeId,
  });
  const branches = branchCtx?.items ?? [];

  const { data } = useQuery({
    queryKey: ["products", storeId],
    queryFn: () => api.get("/products/").then((r) => r.data),
    enabled: !!storeId,
  });
  const { data: alerts } = useQuery({
    queryKey: ["stock-alerts", storeId],
    queryFn: () => api.get("/products/alerts").then((r) => r.data),
    enabled: !!storeId,
  });

  useEffect(() => {
    if (!showForm || branches.length === 0) return;
    setBranchQty((prev) => {
      const next = { ...prev };
      for (const b of branches) {
        if (next[b.id] === undefined) next[b.id] = 0;
      }
      return next;
    });
  }, [showForm, branches]);

  const criticalCount = alerts?.alerts?.filter((a: AlertItem) => a.stock_status === "critical").length ?? 0;
  const lowCount = alerts?.alerts?.filter((a: AlertItem) => a.stock_status === "low").length ?? 0;

  const create = useMutation({
    mutationFn: async (d: typeof form) => {
      const payload: Record<string, unknown> = { ...d };
      if (branches.length > 0) {
        payload.branch_stocks = branches.map((b) => {
          const raw = (branchLead[b.id] ?? "").trim();
          let lead: number | null = null;
          if (raw !== "") {
            const n = Number(raw);
            if (Number.isFinite(n) && n >= 0) lead = Math.min(365, Math.floor(n));
          }
          return {
            branch_id: b.id,
            quantity: Math.max(0, Math.floor(branchQty[b.id] ?? 0)),
            lead_time_days: lead,
          };
        });
      }
      return api.post("/products/", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stock-alerts"] });
      setShowForm(false);
      setBranchQty({});
      setBranchLead({});
      toast.success("Producto creado");
    },
    onError: () => toast.error("No se pudo crear el producto"),
  });

  if (!storeId) {
    return (
      <AppLayout>
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Seleccioná una tienda en el selector superior para ver y gestionar inventario por sede.
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-2">Inventario</h1>
        <p className="text-slate-500">
          Stock por sede dentro de la tienda activa. Las ventas descontarán unidades en la sede que indiques en la API.
        </p>
        {branches.length === 0 && (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
            No hay sedes en esta tienda: el stock queda solo a nivel catálogo hasta que crees al menos una en{" "}
            <Link href="/scheduling/sedes" className="font-semibold text-primary underline">
              Agenda → Sedes
            </Link>
            .
          </p>
        )}
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
            Total unidades = suma por sedes
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
          <div className="flex flex-col gap-3">
            {alerts.alerts.map((a: AlertItem) => (
              <div key={a.id} className="flex flex-wrap items-start gap-2">
                <span className={clsx("badge", a.stock_status === "critical" ? "badge-critical" : "badge-low")}>
                  {a.name} — total {a.stock} u. ({a.days_of_stock?.toFixed(0) ?? "?"} días)
                </span>
                {a.branch_stocks?.length > 0 && (
                  <span className="text-xs text-slate-600">
                    Por sede:{" "}
                    {a.branch_stocks.map((r) => `${r.branch_name}: ${r.quantity}`).join(" · ")}
                  </span>
                )}
              </div>
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
            {branches.length === 0 ? (
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: +e.target.value }))}
                className="input-field"
                placeholder="Stock (sin sedes)"
              />
            ) : null}
            <input
              type="number"
              value={form.lead_time_days}
              onChange={(e) => setForm((f) => ({ ...f, lead_time_days: +e.target.value }))}
              className="input-field"
              placeholder="Días reposición (tienda / defecto)"
            />
          </div>
          {branches.length > 0 && (
            <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
              <h3 className="mb-3 text-sm font-semibold text-on-surface">Stock y reposición por sede</h3>
              <p className="mb-4 text-xs text-slate-500">
                Cantidad en cada local. Los días de reposición por sede son opcionales; si los dejás vacíos se usa el valor
                general del producto para los umbrales.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {branches.map((b) => (
                  <div key={b.id} className="rounded-xl border border-slate-200 bg-surface-container-lowest/80 p-3 dark:border-slate-700">
                    <p className="mb-2 text-xs font-medium text-slate-700 dark:text-slate-300">{b.name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-slate-500">
                        Unidades
                        <input
                          type="number"
                          min={0}
                          className="input-field mt-1"
                          value={branchQty[b.id] ?? 0}
                          onChange={(e) =>
                            setBranchQty((prev) => ({ ...prev, [b.id]: Math.max(0, Math.floor(+e.target.value || 0)) }))
                          }
                        />
                      </label>
                      <label className="text-xs text-slate-500">
                        Días reposición (opc.)
                        <input
                          type="number"
                          min={0}
                          className="input-field mt-1"
                          placeholder={`${form.lead_time_days}`}
                          value={branchLead[b.id] ?? ""}
                          onChange={(e) => setBranchLead((prev) => ({ ...prev, [b.id]: e.target.value }))}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => create.mutate(form)} className="btn-primary" disabled={create.isPending}>
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
              <span
                className={clsx(
                  "badge",
                  p.stock_status === "critical" ? "badge-critical" : p.stock_status === "low" ? "badge-low" : "badge-ok"
                )}
              >
                {p.stock_status}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Stock total</span>
                <span className="font-semibold text-on-surface">{p.stock} u.</span>
              </div>
              {p.branch_stocks?.length > 0 && (
                <div className="rounded-lg bg-slate-50 px-2 py-2 text-xs dark:bg-slate-800/60">
                  <p className="mb-1 font-medium text-slate-600 dark:text-slate-400">Por sede</p>
                  <ul className="space-y-0.5 text-slate-700 dark:text-slate-300">
                    {p.branch_stocks.map((r) => (
                      <li key={r.branch_id} className="flex justify-between gap-2">
                        <span className="truncate">{r.branch_name}</span>
                        <span>
                          {r.quantity} u.
                          {r.lead_time_days != null ? ` · ${r.lead_time_days}d rep.` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
                  <span className={p.days_of_stock < 7 ? "font-semibold text-error" : "text-on-surface"}>
                    {p.days_of_stock.toFixed(0)} días
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
