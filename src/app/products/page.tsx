"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Package, AlertTriangle, TrendingUp, Search, X, Edit2, Trash2,
  ChevronDown, ArrowUpCircle, ArrowDownCircle, BarChart3, Filter,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import clsx from "clsx";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getStoreId } from "@/lib/store";

interface BranchRef { id: string; name: string; }
interface BranchStockRow { branch_id: string; branch_name: string; quantity: number; lead_time_days: number | null; }
interface ProductItem {
  id: string; name: string; sku: string | null; price: number; stock: number;
  cost_price?: number; image_urls?: string[];
  branch_stocks: BranchStockRow[]; stock_status: string; avg_daily_sales: number;
  days_of_stock: number | null; category: string | null; lead_time_days: number;
  description?: string;
}
interface AlertItem { id: string; name: string; stock: number; branch_stocks: BranchStockRow[]; stock_status: string; days_of_stock: number | null; }

const emptyForm = { name: "", description: "", sku: "", price: 0, cost_price: 0, image_url_1: "", image_url_2: "", image_url_3: "", stock: 0, lead_time_days: 3, category: "" };

function fmtCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

function StockBadge({ status }: { status: string }) {
  if (status === "critical") return <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">Critico</span>;
  if (status === "low") return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Bajo</span>;
  return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">OK</span>;
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;

  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductItem | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<ProductItem | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<ProductItem | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [branchQty, setBranchQty] = useState<Record<string, number>>({});
  const [branchLead, setBranchLead] = useState<Record<string, string>>({});
  const [adjustBranch, setAdjustBranch] = useState("");
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [adjustReason, setAdjustReason] = useState("entrada");
  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");

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
  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers", storeId],
    queryFn: () => api.get("/products/suppliers").then((r) => r.data),
    enabled: !!storeId,
  });

  useEffect(() => {
    if (!showCreate || branches.length === 0) return;
    setBranchQty((prev) => {
      const next = { ...prev };
      for (const b of branches) if (next[b.id] === undefined) next[b.id] = 0;
      return next;
    });
  }, [showCreate, branches]);

  useEffect(() => {
    if (editProduct) setEditForm({
      name: editProduct.name, description: editProduct.description ?? "", sku: editProduct.sku ?? "", price: editProduct.price,
      cost_price: editProduct.cost_price ?? 0,
      image_url_1: editProduct.image_urls?.[0] ?? "", image_url_2: editProduct.image_urls?.[1] ?? "", image_url_3: editProduct.image_urls?.[2] ?? "",
      stock: editProduct.stock, lead_time_days: editProduct.lead_time_days, category: editProduct.category ?? ""
    });
  }, [editProduct]);

  const allProducts: ProductItem[] = data?.items ?? [];
  const categories = Array.from(new Set(allProducts.map((p) => p.category).filter(Boolean))) as string[];

  const filtered = allProducts.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || p.category === catFilter;
    const matchStatus = statusFilter === "all" || p.stock_status === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  const totalValue = allProducts.reduce((s, p) => s + p.price * p.stock, 0);
  const criticalCount = alerts?.alerts?.filter((a: AlertItem) => a.stock_status === "critical").length ?? 0;

  const create = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { ...form };
      payload.image_urls = [form.image_url_1, form.image_url_2, form.image_url_3].map((x) => x.trim()).filter(Boolean).slice(0, 3);
      if (branches.length > 0) {
        payload.branch_stocks = branches.map((b) => {
          const raw = (branchLead[b.id] ?? "").trim();
          const lead = raw !== "" && Number.isFinite(+raw) && +raw >= 0 ? Math.floor(+raw) : null;
          return { branch_id: b.id, quantity: Math.max(0, Math.floor(branchQty[b.id] ?? 0)), lead_time_days: lead };
        });
      }
      return api.post("/products/", payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["stock-alerts"] }); setShowCreate(false); setBranchQty({}); setBranchLead({}); setForm(emptyForm); toast.success("Producto creado"); },
    onError: () => toast.error("No se pudo crear el producto"),
  });

  const update = useMutation({
    mutationFn: (id: string) => api.patch(`/products/${id}`, {
      ...editForm,
      image_urls: [editForm.image_url_1, editForm.image_url_2, editForm.image_url_3].map((x) => x.trim()).filter(Boolean).slice(0, 3),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setEditProduct(null); toast.success("Producto actualizado"); },
    onError: () => toast.error("Error al actualizar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["stock-alerts"] }); setDeleteProduct(null); toast.success("Producto eliminado"); },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const adjust = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.post(`/products/${id}/adjust-stock`, { branch_id: adjustBranch || null, delta: adjustDelta, reason: adjustReason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["stock-alerts"] }); setAdjustProduct(null); setAdjustDelta(0); toast.success("Stock ajustado"); },
    onError: () => toast.error("Error al ajustar stock"),
  });
  const createSupplier = useMutation({
    mutationFn: () => api.post("/products/suppliers", { name: supplierName, email: supplierEmail }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setSupplierName("");
      setSupplierEmail("");
      toast.success("Proveedor creado");
    },
    onError: () => toast.error("No se pudo crear proveedor"),
  });
  const quoteLowStock = useMutation({
    mutationFn: () => api.post("/products/quotes", { product_ids: (alerts?.alerts ?? []).map((a: AlertItem) => a.id) }),
    onSuccess: () => toast.success("Cotizaciones enviadas"),
    onError: () => toast.error("No se pudieron enviar cotizaciones"),
  });

  if (!storeId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50 py-16 text-center dark:border-amber-900/50 dark:bg-amber-950/20">
          <Package className="mb-3 h-10 w-10 text-amber-400" />
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Selecciona una tienda</p>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Elige una tienda activa para gestionar productos</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Inventario</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl mb-2">Productos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Control de stock por sede, movimientos y alertas automaticas.</p>
        <div className="mt-2">
          <Link href="/products/sedes" className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">Ver reporte por sede</Link>
        </div>
        {branches.length === 0 && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            Sin sedes configuradas — stock global hasta que crees una en{" "}
            <Link href="/scheduling/sedes" className="font-semibold underline">Agenda → Sedes</Link>.
          </p>
        )}
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { icon: <MaterialIcon name="inventory_2" className="text-xl" filled />, bg: "bg-blue-100 dark:bg-blue-900/30", iconColor: "text-blue-600 dark:text-blue-400", label: "Productos", value: allProducts.length, tag: "Total" },
          { icon: <BarChart3 className="h-5 w-5" />, bg: "bg-purple-100 dark:bg-purple-900/30", iconColor: "text-purple-600 dark:text-purple-400", label: "Stock valorizado", value: fmtCLP(totalValue), tag: "Valor" },
          { icon: <AlertTriangle className="h-5 w-5" />, bg: "bg-rose-100 dark:bg-rose-900/30", iconColor: "text-rose-600 dark:text-rose-400", label: "Stock critico", value: criticalCount, tag: "Alertas" },
          { icon: <TrendingUp className="h-5 w-5" />, bg: "bg-emerald-100 dark:bg-emerald-900/30", iconColor: "text-emerald-600 dark:text-emerald-400", label: "Sedes activas", value: branches.length, tag: "Sedes" },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.bg} ${kpi.iconColor}`}>{kpi.icon}</div>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${kpi.iconColor}`}>{kpi.tag}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{kpi.label}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white truncate">{kpi.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Alerts */}
      {alerts?.alerts?.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            <h3 className="font-semibold text-rose-900 dark:text-rose-200">Alertas de stock</h3>
          </div>
          <div className="flex flex-col gap-2">
            {alerts.alerts.map((a: AlertItem) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2">
                <StockBadge status={a.stock_status} />
                <span className="text-sm text-slate-700 dark:text-slate-300">{a.name} — {a.stock} u.{a.days_of_stock != null ? ` · ${a.days_of_stock.toFixed(0)} dias` : ""}</span>
                {a.branch_stocks?.length > 0 && (
                  <span className="text-xs text-slate-500">{a.branch_stocks.map((r) => `${r.branch_name}: ${r.quantity}`).join(" · ")}</span>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="mt-3 flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50" onClick={() => quoteLowStock.mutate()} disabled={quoteLowStock.isPending}>
            Generar cotizacion por proveedor
          </button>
        </motion.div>
      )}

      {/* Proveedores inline */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Proveedores</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Nombre proveedor" />
          <input value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Email proveedor" />
          <button type="button" className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50" disabled={!supplierName.trim() || !supplierEmail.trim() || createSupplier.isPending} onClick={() => createSupplier.mutate()}>
            <Plus className="h-3.5 w-3.5" /> Agregar
          </button>
        </div>
        <p className="text-xs text-slate-400">{(suppliersData?.items ?? []).length} proveedor(es) registrados.</p>
      </div>

      {/* Search + Filters + Add */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-4 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Buscar por nombre o SKU..." />
          </div>
          <button type="button" onClick={() => setShowFilters(!showFilters)}
            className={clsx("flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
              showFilters ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950/30 dark:text-blue-400" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300")}>
            <Filter className="h-4 w-4" /> Filtros <ChevronDown className={clsx("h-3 w-3 transition-transform", showFilters && "rotate-180")} />
          </button>
        </div>
        <button type="button" onClick={() => setShowCreate(!showCreate)} className="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-95">
          <Plus className="h-4 w-4" /> Nuevo producto
        </button>
      </div>

      {showFilters && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Categoria</label>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="all">Todas</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado de stock</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="all">Todos</option>
              <option value="ok">Optimo</option>
              <option value="low">Bajo</option>
              <option value="critical">Critico</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={() => { setCatFilter("all"); setStatusFilter("all"); setSearch(""); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">Limpiar</button>
          </div>
        </motion.div>
      )}

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">Nuevo producto</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Nombre *" />
              <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="SKU / codigo" />
              <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Categoria" />
              <div>
                <label className="mb-1 block text-xs text-slate-500">Precio de venta (CLP)</label>
                <input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: +e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="0" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Valor compra (CLP)</label>
                <input type="number" value={form.cost_price} onChange={(e) => setForm((f) => ({ ...f, cost_price: +e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="0" />
              </div>
              {branches.length === 0 && (
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Stock inicial</label>
                  <input type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: +e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs text-slate-500">Dias de reposicion</label>
                <input type="number" value={form.lead_time_days} onChange={(e) => setForm((f) => ({ ...f, lead_time_days: +e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white md:col-span-3" placeholder="Descripcion (opcional)" />
              <input value={form.image_url_1} onChange={(e) => setForm((f) => ({ ...f, image_url_1: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Imagen 1 (URL)" />
              <input value={form.image_url_2} onChange={(e) => setForm((f) => ({ ...f, image_url_2: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Imagen 2 (URL)" />
              <input value={form.image_url_3} onChange={(e) => setForm((f) => ({ ...f, image_url_3: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Imagen 3 (URL)" />
            </div>
            {branches.length > 0 && (
              <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
                <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Stock inicial por sede</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {branches.map((b) => (
                    <div key={b.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                      <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{b.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-slate-500">Unidades
                          <input type="number" min={0} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" value={branchQty[b.id] ?? 0}
                            onChange={(e) => setBranchQty((p) => ({ ...p, [b.id]: Math.max(0, Math.floor(+e.target.value || 0)) }))} />
                        </label>
                        <label className="text-xs text-slate-500">Dias reposicion
                          <input type="number" min={0} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder={`${form.lead_time_days}`}
                            value={branchLead[b.id] ?? ""} onChange={(e) => setBranchLead((p) => ({ ...p, [b.id]: e.target.value }))} />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => create.mutate()} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50" disabled={create.isPending || !form.name}>Crear producto</button>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Cancelar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-20 text-center dark:border-slate-700">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <Package className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
            {search || catFilter !== "all" || statusFilter !== "all" ? "Sin resultados" : "Sin productos aun"}
          </p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
            {search || catFilter !== "all" || statusFilter !== "all" ? "Prueba con otros filtros" : "Agrega tu primer producto al inventario"}
          </p>
          {!search && catFilter === "all" && statusFilter === "all" && (
            <button type="button" onClick={() => setShowCreate(true)} className="mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-95">
              <Plus className="h-4 w-4" /> Agregar producto
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">{filtered.length} de {allProducts.length} productos</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p: ProductItem) => (
              <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                {/* Header */}
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {p.image_urls?.[0] ? (
                      <img src={p.image_urls[0]} alt={p.name} className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                        <Package className="h-5 w-5 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">{p.name}</h3>
                      {p.sku && <p className="text-xs text-slate-400">SKU: {p.sku}</p>}
                      {p.category && <p className="text-xs text-slate-400">{p.category}</p>}
                    </div>
                  </div>
                  <StockBadge status={p.stock_status} />
                </div>

                {/* Stats */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Precio</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{fmtCLP(p.price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Valor compra</span>
                    <span className="text-slate-700 dark:text-slate-300">{fmtCLP(p.cost_price ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Stock total</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{p.stock} u.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Valor en stock</span>
                    <span className="text-slate-700 dark:text-slate-300">{fmtCLP(p.price * p.stock)}</span>
                  </div>
                  {p.branch_stocks?.length > 0 && (
                    <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs dark:bg-slate-800/60">
                      <p className="mb-1 font-medium text-slate-600 dark:text-slate-400">Por sede</p>
                      <ul className="space-y-0.5 text-slate-700 dark:text-slate-300">
                        {p.branch_stocks.map((r) => (
                          <li key={r.branch_id} className="flex justify-between gap-2">
                            <span className="truncate">{r.branch_name}</span>
                            <span>{r.quantity} u.{r.lead_time_days != null ? ` · ${r.lead_time_days}d` : ""}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {p.days_of_stock != null && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Dias restantes</span>
                      <span className={p.days_of_stock < 7 ? "font-semibold text-rose-600" : "text-slate-700 dark:text-slate-300"}>{p.days_of_stock.toFixed(0)} dias</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button type="button" onClick={() => { setAdjustProduct(p); setAdjustBranch(branches[0]?.id ?? ""); setAdjustDelta(0); setAdjustReason("entrada"); }}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                    <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600" /> Ajustar stock
                  </button>
                  <button type="button" onClick={() => setEditProduct(p)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                    <Edit2 className="h-3.5 w-3.5 text-blue-600" /> Editar
                  </button>
                  <button type="button" onClick={() => setDeleteProduct(p)}
                    className="ml-auto flex items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/30">
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg overflow-y-auto max-h-[calc(100dvh-2rem)] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Editar producto</h3>
                <button type="button" onClick={() => setEditProduct(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Nombre *</label>
                  <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">SKU</label>
                  <input value={editForm.sku} onChange={(e) => setEditForm((f) => ({ ...f, sku: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Categoria</label>
                  <input value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Precio (CLP)</label>
                  <input type="number" value={editForm.price} onChange={(e) => setEditForm((f) => ({ ...f, price: +e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Valor compra (CLP)</label>
                  <input type="number" value={editForm.cost_price} onChange={(e) => setEditForm((f) => ({ ...f, cost_price: +e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dias de reposicion</label>
                  <input type="number" value={editForm.lead_time_days} onChange={(e) => setEditForm((f) => ({ ...f, lead_time_days: +e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Descripcion</label>
                  <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white min-h-[72px] resize-none" />
                </div>
                <input value={editForm.image_url_1} onChange={(e) => setEditForm((f) => ({ ...f, image_url_1: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white md:col-span-2" placeholder="Imagen 1 (URL)" />
                <input value={editForm.image_url_2} onChange={(e) => setEditForm((f) => ({ ...f, image_url_2: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white md:col-span-2" placeholder="Imagen 2 (URL)" />
                <input value={editForm.image_url_3} onChange={(e) => setEditForm((f) => ({ ...f, image_url_3: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white md:col-span-2" placeholder="Imagen 3 (URL)" />
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => setEditProduct(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Cancelar</button>
                <button type="button" onClick={() => update.mutate(editProduct.id)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50" disabled={update.isPending || !editForm.name}>Guardar cambios</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Adjust stock modal */}
      <AnimatePresence>
        {adjustProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Ajustar stock</h3>
                <button type="button" onClick={() => setAdjustProduct(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
              </div>
              <p className="mb-4 text-sm text-slate-700 dark:text-slate-300"><strong>{adjustProduct.name}</strong> — stock actual: <strong>{adjustProduct.stock} u.</strong></p>
              <div className="space-y-4">
                {branches.length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sede</label>
                    <select value={adjustBranch} onChange={(e) => setAdjustBranch(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                      <option value="">Global (sin sede)</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipo de movimiento</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "entrada", label: "Entrada", icon: ArrowUpCircle, color: "emerald" },
                      { value: "salida", label: "Salida", icon: ArrowDownCircle, color: "rose" },
                      { value: "ajuste", label: "Ajuste", icon: Edit2, color: "blue" }
                    ].map(({ value, label, icon: Icon }) => (
                      <button key={value} type="button" onClick={() => setAdjustReason(value)}
                        className={clsx("flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-xs font-semibold transition-all",
                          adjustReason === value
                            ? value === "entrada" ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30"
                              : value === "salida" ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/30"
                              : "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30"
                            : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400")}>
                        <Icon className="h-4 w-4" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {adjustReason === "salida" ? "Unidades a retirar" : adjustReason === "ajuste" ? "Cantidad final" : "Unidades a agregar"}
                  </label>
                  <input type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" value={adjustDelta === 0 ? "" : adjustDelta}
                    onChange={(e) => setAdjustDelta(+e.target.value || 0)} placeholder="0" />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => setAdjustProduct(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Cancelar</button>
                <button type="button" className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50" disabled={adjust.isPending || adjustDelta === 0}
                  onClick={() => adjust.mutate({ id: adjustProduct.id })}>
                  Confirmar ajuste
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirm modal */}
      <AnimatePresence>
        {deleteProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/30">
                <Trash2 className="h-6 w-6 text-rose-600" />
              </div>
              <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">Eliminar producto</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Seguro que quieres eliminar <strong>{deleteProduct.name}</strong>? Esta accion no se puede deshacer.</p>
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => setDeleteProduct(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Cancelar</button>
                <button type="button" onClick={() => remove.mutate(deleteProduct.id)} disabled={remove.isPending}
                  className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                  {remove.isPending ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
