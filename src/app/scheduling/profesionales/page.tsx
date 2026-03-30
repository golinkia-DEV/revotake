"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckSquare, Loader2, Plus, UserPlus } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { getStoreId } from "@/lib/store";
import { toast } from "sonner";

type BranchRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type ServiceRow = {
  id: string;
  name: string;
  category: string | null;
  menu_sort_order: number;
  is_active: boolean;
};

function categoryLabel(c: string | null) {
  const t = (c || "").trim();
  return t || "General";
}

export default function CrearProfesionalPage() {
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const qc = useQueryClient();

  const { data: branchesData, isLoading: loadingBranches } = useQuery({
    queryKey: ["scheduling-branches", storeId],
    queryFn: () => api.get<{ items: BranchRow[] }>("/scheduling/branches").then((r) => r.data),
    enabled: !!storeId,
  });

  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ["scheduling-services", storeId],
    queryFn: () => api.get<{ items: ServiceRow[] }>("/scheduling/services").then((r) => r.data),
    enabled: !!storeId,
  });

  const branches = branchesData?.items ?? [];
  const servicesAll = servicesData?.items ?? [];
  const activeServices = useMemo(() => servicesAll.filter((s) => s.is_active), [servicesAll]);

  const servicesByCategory = useMemo(() => {
    const m = new Map<string, ServiceRow[]>();
    for (const s of activeServices) {
      const k = categoryLabel(s.category);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.menu_sort_order - b.menu_sort_order || a.name.localeCompare(b.name));
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [activeServices]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [commissionByService, setCommissionByService] = useState<Record<string, string>>({});
  const [productCommission, setProductCommission] = useState("");

  useEffect(() => {
    setCommissionByService((prev) => {
      const next = { ...prev };
      for (const id of serviceIds) {
        if (next[id] === undefined) next[id] = "0";
      }
      for (const k of Object.keys(next)) {
        if (!serviceIds.includes(k)) delete next[k];
      }
      return next;
    });
  }, [serviceIds]);

  const createProfessional = useMutation({
    mutationFn: (body: {
      name: string;
      email: string;
      phone: string;
      branch_ids: string[];
      service_ids: string[];
      service_commissions: Record<string, number>;
      product_commission_percent: number | null;
    }) => api.post("/scheduling/professionals", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-professionals"] });
      toast.success("Invitación enviada por correo con enlace para crear contraseña");
      setName("");
      setEmail("");
      setPhone("");
      setBranchIds([]);
      setServiceIds([]);
      setCommissionByService({});
      setProductCommission("");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? String((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "")
          : "";
      toast.error(msg || "No se pudo crear el profesional");
    },
  });

  function toggleId(list: string[], id: string, on: boolean) {
    return on ? [...new Set([...list, id])] : list.filter((x) => x !== id);
  }

  const loading = loadingBranches || loadingServices;
  const commissionsOk = serviceIds.every((id) => {
    const v = parseFloat(commissionByService[id] ?? "0");
    return !Number.isNaN(v) && v >= 0 && v <= 100;
  });
  const canSubmit =
    name.trim().length > 0 &&
    email.trim().includes("@") &&
    phone.trim().length >= 6 &&
    branchIds.length > 0 &&
    serviceIds.length > 0 &&
    commissionsOk &&
    !createProfessional.isPending;

  function submit() {
    const service_commissions: Record<string, number> = {};
    for (const id of serviceIds) {
      service_commissions[id] = parseFloat(commissionByService[id] || "0") || 0;
    }
    let product_commission_percent: number | null = null;
    if (productCommission.trim() !== "") {
      const p = parseFloat(productCommission.replace(",", "."));
      if (!Number.isNaN(p) && p >= 0 && p <= 100) product_commission_percent = p;
    }
    createProfessional.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      branch_ids: branchIds,
      service_ids: serviceIds,
      service_commissions,
      product_commission_percent,
    });
  }

  if (!storeId) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-600">Selecciona una tienda en el selector superior.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Agenda</p>
        <h1 className="mb-2 flex items-center gap-2 text-3xl font-extrabold tracking-tight text-on-surface">
          <UserPlus className="h-8 w-8 text-primary" />
          Crear profesional
        </h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Correro y celular son obligatorios. Se envía un <strong>enlace por correo</strong> para que la persona cree su
          contraseña y acceda como operador. Definí comisión % por cada servicio y, si aplica, un único % para
          productos de inventario.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/scheduling" className="font-semibold text-primary hover:underline">
            ← Volver a Citas
          </Link>
          {" · "}
          <Link href="/equipo" className="font-semibold text-primary hover:underline">
            Equipo y permisos
          </Link>
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando sedes y servicios…
          </div>
        ) : branches.length === 0 ? (
          <p className="text-sm text-slate-600">
            Primero creá al menos una sede en{" "}
            <Link href="/scheduling/sedes" className="font-semibold text-primary hover:underline">
              Sedes y equipo
            </Link>
            .
          </p>
        ) : activeServices.length === 0 ? (
          <p className="text-sm text-slate-600">
            No hay servicios activos en el menú. Agregá servicios en{" "}
            <Link href="/scheduling/services" className="font-semibold text-primary hover:underline">
              Menú de servicios
            </Link>{" "}
            y volvé aquí.
          </p>
        ) : (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Nombre *</span>
                <input
                  className="input-field w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Camila Rojas"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Correo electrónico *</span>
                <input
                  className="input-field w-full"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@ejemplo.cl"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Celular *</span>
                <input
                  className="input-field w-full"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                />
              </label>
            </div>

            <div className="mb-6">
              <p className="mb-2 text-sm font-semibold text-on-surface">Sedes donde atiende *</p>
              <p className="mb-3 text-xs text-slate-500">Al menos una.</p>
              <div className="flex flex-wrap gap-3">
                {branches.map((b) => (
                  <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={branchIds.includes(b.id)}
                      disabled={!b.is_active}
                      onChange={(e) => setBranchIds((prev) => toggleId(prev, b.id, e.target.checked))}
                    />
                    <span className={b.is_active ? "" : "text-slate-400 line-through"}>{b.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-6 border-t border-slate-100 pt-6 dark:border-slate-800">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-on-surface">
                <CheckSquare className="h-4 w-4 text-primary" />
                Servicios y comisión % (por servicio) *
              </p>
              <p className="mb-4 text-xs text-slate-500">Porcentaje entre 0 y 100 sobre el cobro de cada servicio completado.</p>
              <div className="max-h-[min(52vh,480px)] space-y-5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                {servicesByCategory.map(([cat, rows]) => (
                  <div key={cat}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{cat}</p>
                    <ul className="space-y-3">
                      {rows.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-white/80 px-2 py-2 dark:bg-slate-900/50">
                          <label className="flex min-w-[160px] flex-1 cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={serviceIds.includes(s.id)}
                              onChange={(e) => setServiceIds((prev) => toggleId(prev, s.id, e.target.checked))}
                            />
                            <span className="text-on-surface">{s.name}</span>
                          </label>
                          {serviceIds.includes(s.id) && (
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              Comisión %
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                className="w-20 rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950"
                                value={commissionByService[s.id] ?? "0"}
                                onChange={(e) =>
                                  setCommissionByService((prev) => ({ ...prev, [s.id]: e.target.value }))
                                }
                              />
                            </label>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                  Comisión sobre productos (inventario), único % para todos los productos
                </span>
                <span className="mb-2 block text-xs text-slate-500">
                  Opcional. Dejá vacío si no aplica comisión por ventas de productos para este profesional.
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className="input-field max-w-xs"
                  value={productCommission}
                  onChange={(e) => setProductCommission(e.target.value)}
                  placeholder="Ej. 5"
                />
              </label>
            </div>

            <p className="mb-4 text-xs text-amber-800 dark:text-amber-200">
              Requiere correo configurado en el servidor (Resend o SMTP). Si falla el envío, no se guarda el alta.
            </p>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {createProfessional.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Crear e invitar por correo
            </button>
          </>
        )}
      </section>
    </AppLayout>
  );
}
