"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  Legend,
} from "recharts";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { toast } from "sonner";

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

export default function ProveedoresPage() {
  const qc = useQueryClient();
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
  });

  const createSupplier = useMutation({
    mutationFn: () => api.post("/products/suppliers", form),
    onSuccess: () => {
      toast.success("Proveedor guardado");
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["suppliers-full"] });
    },
    onError: () => toast.error("No se pudo guardar proveedor"),
  });

  const suppliers: SupplierRow[] = suppliersData?.items ?? [];
  const bySupplier = reportData?.by_supplier ?? [];
  const lineData = reportData?.timeline ?? [];
  const summary = reportData?.summary ?? {};

  const barData = useMemo(
    () =>
      bySupplier.map((x: { supplier_name: string; amount_total: number; purchases_count: number }) => ({
        name: x.supplier_name,
        total: x.amount_total,
        compras: x.purchases_count,
      })),
    [bySupplier],
  );

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-on-surface">Proveedores</h1>
        <p className="text-sm text-slate-500">Ficha completa de proveedores, historial de compras y reportes por período.</p>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <h2 className="mb-3 font-semibold text-on-surface">Agregar proveedor</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input className="input-field" placeholder="Nombre comercial *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="input-field" placeholder="Razón social" value={form.legal_name} onChange={(e) => setForm((f) => ({ ...f, legal_name: e.target.value }))} />
          <input className="input-field" placeholder="RUT" value={form.rut} onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))} />
          <input className="input-field" placeholder="Contacto" value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
          <input className="input-field" placeholder="Email *" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <input className="input-field" placeholder="Teléfono" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <input className="input-field md:col-span-2" placeholder="Dirección" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          <input className="input-field" placeholder="Región" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} />
          <input className="input-field" placeholder="Ciudad / comuna" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          <input className="input-field" placeholder="Sitio web" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
          <input className="input-field" placeholder="Condiciones de pago" value={form.payment_terms} onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))} />
          <textarea className="input-field md:col-span-3 min-h-[80px]" placeholder="Notas" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="mt-3">
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!form.name.trim() || !form.email.trim() || createSupplier.isPending}
            onClick={() => createSupplier.mutate()}
          >
            Guardar proveedor
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <h2 className="mb-2 font-semibold text-on-surface">Listado de proveedores</h2>
        <p className="mb-3 text-xs text-slate-500">{suppliers.length} proveedor(es)</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {suppliers.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="font-semibold text-on-surface">{s.name}</p>
              <p className="text-xs text-slate-500">{s.legal_name || "Sin razón social"} · {s.rut || "Sin RUT"}</p>
              <p className="text-sm text-slate-600">{s.contact_name || "-"} · {s.email}</p>
              <p className="text-xs text-slate-500">{s.phone || "-"} · {s.city || "-"}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Desde</label>
          <input type="date" className="input-field" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Hasta</label>
          <input type="date" className="input-field" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-slate-500">Total comprado</p>
          <p className="text-lg font-bold text-on-surface">{money(summary.amount_total || 0)}</p>
          <p className="text-xs text-slate-500">{summary.purchases_count || 0} compras · {summary.suppliers_with_purchases || 0} proveedores</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <h3 className="mb-3 font-semibold text-on-surface">Compras por proveedor</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Legend />
                <Bar dataKey="total" name="Total comprado" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <h3 className="mb-3 font-semibold text-on-surface">Histórico (línea de tiempo)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Legend />
                {(reportData?.timeline_keys ?? []).slice(0, 6).map((k: string, idx: number) => (
                  <Line key={k} dataKey={k} stroke={["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4"][idx % 6]} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <h3 className="mb-3 font-semibold text-on-surface">Top productos comprados por proveedor</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Proveedor</th>
                <th className="py-2">Producto</th>
                <th className="py-2">Unidades</th>
                <th className="py-2">Monto</th>
              </tr>
            </thead>
            <tbody>
              {(reportData?.top_products ?? []).map((r: { supplier_name: string; product_name: string; units_total: number; amount_total: number }, idx: number) => (
                <tr key={`${r.supplier_name}-${r.product_name}-${idx}`} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2">{r.supplier_name}</td>
                  <td className="py-2">{r.product_name}</td>
                  <td className="py-2">{r.units_total}</td>
                  <td className="py-2">{money(r.amount_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}

