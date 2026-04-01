"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Truck, Mail, Phone, MapPin, ShoppingCart } from "lucide-react";
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
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { getStoreId } from "@/lib/store";

type SupplierRow = {
  id: string;
  name: string;
  legal_name?: string | null;
  rut?: string | null;
  contact_name?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  region?: string | null;
  city?: string | null;
  website?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  is_active?: boolean;
};

const EMPTY = {
  name: "",
  legal_name: "",
  rut: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  region: "",
  city: "",
  website: "",
  payment_terms: "",
  notes: "",
  is_active: true,
};

function money(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(
    Math.round(n || 0),
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: "emerald" | "amber" | "rose" | "blue" | "slate" | "purple" }) {
  const c = {
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  }[color];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}

export default function ProveedoresPage() {
  const qc = useQueryClient();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers-full"],
    queryFn: () => api.get("/products/suppliers").then((r) => r.data),
  });

  const { data: reportData } = useQuery({
    queryKey: ["suppliers-report", fromDate, toDate],
    queryFn: () => api.get("/products/suppliers/report", { params: { from_date: fromDate, to_date: toDate } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const createSupplier = useMutation({
    mutationFn: () => api.post("/products/suppliers", form),
    onSuccess: () => {
      toast.success("Proveedor guardado");
      setForm(EMPTY);
      setShowAddSupplier(false);
      qc.invalidateQueries({ queryKey: ["suppliers-full"] });
    },
    onError: () => toast.error("No se pudo guardar proveedor"),
  });

  const suppliers: SupplierRow[] = suppliersData?.items ?? [];
  const summary = reportData?.summary ?? {};
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

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Proveedores</h1>
          <p className="mt-1 text-sm text-slate-500">Ficha completa, historial de compras y reportes por período.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddSupplier(true)}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          Nuevo proveedor
        </button>
      </div>

      {/* Supplier cards */}
      {suppliers.length === 0 ? (
        <div className="mb-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-20 text-center dark:border-slate-700">
          <Truck className="mb-4 h-14 w-14 text-slate-300 dark:text-slate-600" />
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Sin proveedores registrados</p>
          <p className="mt-1 text-sm text-slate-500">Agrega tu primer proveedor para comenzar a registrar compras.</p>
          <button
            type="button"
            onClick={() => setShowAddSupplier(true)}
            className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all"
          >
            Agregar proveedor
          </button>
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{s.name}</p>
                  {s.legal_name && <p className="text-xs text-slate-500">{s.legal_name}</p>}
                </div>
                {s.rut && <Badge color="slate">{s.rut}</Badge>}
              </div>
              <div className="space-y-1.5">
                {s.contact_name && (
                  <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium">{s.contact_name}</span>
                  </p>
                )}
                {s.email && (
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {s.email}
                  </p>
                )}
                {s.phone && (
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {s.phone}
                  </p>
                )}
                {(s.city || s.region) && (
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {[s.city, s.region].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reports section */}
      {!storeId ? (
        <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Seleccioná una tienda para ver reportes y gráficos de compras.
        </p>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Compras a proveedores</h2>
              <p className="mt-0.5 text-sm text-slate-500">Totales del período respecto a compras registradas.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Desde</label>
                <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-800" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Hasta</label>
                <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-800" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Summary stats */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-900/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">Total comprado</p>
              <p className="mt-1 text-xl font-bold text-blue-900 dark:text-blue-100">{money(summary.amount_total || 0)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compras</p>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{summary.purchases_count || 0}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Proveedores</p>
              <p className="mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-100">{summary.suppliers_with_purchases || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <h3 className="mb-1 font-semibold text-slate-900 dark:text-white">Compras por proveedor</h3>
              <p className="mb-4 text-xs text-slate-500">Monto total por proveedor en el período.</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ReTooltip formatter={(value) => money(Number(value))} />
                    <Legend />
                    <Bar dataKey="total" name="Total comprado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <h3 className="mb-1 font-semibold text-slate-900 dark:text-white">Histórico (línea de tiempo)</h3>
              <p className="mb-4 text-xs text-slate-500">Evolución de compras en el período seleccionado.</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ReTooltip formatter={(value) => money(Number(value))} />
                    <Legend />
                    {(reportData?.timeline_keys ?? []).slice(0, 6).map((k: string, idx: number) => (
                      <Line
                        key={k}
                        dataKey={k}
                        stroke={["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4"][idx % 6]}
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            Resumen operativo global en el{" "}
            <Link href="/dashboard" className="font-semibold text-blue-600 hover:underline">
              panel principal
            </Link>
            .
          </p>
        </motion.div>
      )}

      {/* Top products table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-slate-400" />
          <h3 className="font-semibold text-slate-900 dark:text-white">Top productos comprados por proveedor</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                <th className="pb-3 pr-4">Proveedor</th>
                <th className="pb-3 pr-4">Producto</th>
                <th className="pb-3 pr-4">Unidades</th>
                <th className="pb-3">Monto</th>
              </tr>
            </thead>
            <tbody>
              {(reportData?.top_products ?? []).map((r: { supplier_name: string; product_name: string; units_total: number; amount_total: number }, idx: number) => (
                <tr
                  key={`${r.supplier_name}-${r.product_name}-${idx}`}
                  className={`border-t border-slate-100 dark:border-slate-800 ${idx % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-slate-800/30"}`}
                >
                  <td className="py-2.5 pr-4 font-medium text-slate-700 dark:text-slate-300">{r.supplier_name}</td>
                  <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-400">{r.product_name}</td>
                  <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-400">{r.units_total}</td>
                  <td className="py-2.5 font-semibold text-emerald-700 dark:text-emerald-400">{money(r.amount_total)}</td>
                </tr>
              ))}
              {(reportData?.top_products ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-slate-500">
                    No hay datos para el período seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear proveedor */}
      <AnimatePresence>
        {showAddSupplier && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-[2px] sm:items-center"
            onClick={() => { setShowAddSupplier(false); setForm(EMPTY); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-supplier-title"
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[min(90vh,720px)] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <h2 id="add-supplier-title" className="text-lg font-bold text-slate-900 dark:text-white">
                  Nuevo proveedor
                </h2>
                <button
                  type="button"
                  onClick={() => { setShowAddSupplier(false); setForm(EMPTY); }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[calc(90vh-8rem)] overflow-y-auto p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {[
                    { label: "Nombre comercial *", field: "name" as const, span: 1 },
                    { label: "Razón social", field: "legal_name" as const, span: 1 },
                    { label: "RUT", field: "rut" as const, span: 1 },
                    { label: "Contacto", field: "contact_name" as const, span: 1 },
                    { label: "Email *", field: "email" as const, span: 1 },
                    { label: "Teléfono", field: "phone" as const, span: 1 },
                    { label: "Dirección", field: "address" as const, span: 2 },
                    { label: "Región", field: "region" as const, span: 1 },
                    { label: "Ciudad / comuna", field: "city" as const, span: 1 },
                    { label: "Sitio web", field: "website" as const, span: 1 },
                    { label: "Condiciones de pago", field: "payment_terms" as const, span: 1 },
                  ].map(({ label, field, span }) => (
                    <div key={field} className={span === 2 ? "md:col-span-2" : ""}>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{label}</label>
                      <input
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-800"
                        value={form[field] as string}
                        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Notas</label>
                    <textarea
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-800 min-h-[80px]"
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/80">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  onClick={() => { setShowAddSupplier(false); setForm(EMPTY); }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                  disabled={!form.name.trim() || !form.email.trim() || createSupplier.isPending}
                  onClick={() => createSupplier.mutate()}
                >
                  {createSupplier.isPending ? "Guardando…" : "Guardar proveedor"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
