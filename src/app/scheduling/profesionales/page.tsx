"use client";

import { useMutation, useQuery, useQueryClient, useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckSquare, Loader2, Plus, UserPlus, Mail, Phone, MapPin, Calendar, Building2 } from "lucide-react";
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

const inputCls = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-800";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
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
  const [firstName, setFirstName] = useState("");
  const [paternalLastName, setPaternalLastName] = useState("");
  const [maternalLastName, setMaternalLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [address, setAddress] = useState("");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [commissionByService, setCommissionByService] = useState<Record<string, string>>({});
  const [productCommission, setProductCommission] = useState("");
  const [stationMode, setStationMode] = useState<"none" | "fixed" | "dynamic">("none");
  const [stationId, setStationId] = useState("");

  const branchStationsQueries = useQueries({
    queries: branchIds.map((bid) => ({
      queryKey: ["scheduling-branch-stations", storeId, bid] as const,
      queryFn: () =>
        api.get<{ items: { id: string; name: string; kind: string; branch_id: string }[] }>(`/scheduling/branches/${bid}/stations`).then((r) => r.data),
      enabled: !!storeId && branchIds.length > 0,
    })),
  });
  const stationsForPick = branchStationsQueries.flatMap((q, i) =>
    (q.data?.items ?? []).map((s) => ({ ...s, _branchId: branchIds[i] }))
  );

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
      first_name: string;
      paternal_last_name: string;
      maternal_last_name: string;
      birth_date: string;
      hire_date: string;
      address: string;
      email: string;
      phone: string;
      branch_ids: string[];
      service_ids: string[];
      service_commissions: Record<string, number>;
      product_commission_percent: number | null;
      station_mode?: "none" | "fixed" | "dynamic";
      default_station_id?: string | null;
    }) => api.post("/scheduling/professionals", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-professionals"] });
      toast.success("Invitación enviada por correo con enlace para crear contraseña");
      setName("");
      setFirstName("");
      setPaternalLastName("");
      setMaternalLastName("");
      setBirthDate("");
      setHireDate("");
      setAddress("");
      setEmail("");
      setPhone("");
      setBranchIds([]);
      setServiceIds([]);
      setCommissionByService({});
      setProductCommission("");
      setStationMode("none");
      setStationId("");
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
    firstName.trim().length > 0 &&
    paternalLastName.trim().length > 0 &&
    maternalLastName.trim().length > 0 &&
    birthDate.trim().length > 0 &&
    hireDate.trim().length > 0 &&
    address.trim().length > 0 &&
    email.trim().includes("@") &&
    phone.trim().length >= 6 &&
    branchIds.length > 0 &&
    serviceIds.length > 0 &&
    commissionsOk &&
    !(stationMode === "fixed" && !stationId.trim()) &&
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
      first_name: firstName.trim(),
      paternal_last_name: paternalLastName.trim(),
      maternal_last_name: maternalLastName.trim(),
      birth_date: birthDate.trim(),
      hire_date: hireDate.trim(),
      address: address.trim(),
      email: email.trim(),
      phone: phone.trim(),
      branch_ids: branchIds,
      service_ids: serviceIds,
      service_commissions,
      product_commission_percent,
      station_mode: stationMode,
      default_station_id: stationMode === "fixed" && stationId.trim() ? stationId.trim() : null,
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
      {/* Header */}
      <div className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Agenda</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Crear profesional</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
          Correo y celular son obligatorios. Se envía un <strong>enlace por correo</strong> para que la persona cree su contraseña y acceda como operador.
        </p>
        <div className="mt-2 flex gap-3 text-sm">
          <Link href="/scheduling" className="font-semibold text-blue-600 hover:underline">
            ← Volver a Citas
          </Link>
          <span className="text-slate-300">·</span>
          <Link href="/equipo" className="font-semibold text-blue-600 hover:underline">
            Equipo y permisos
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando sedes y servicios…
        </div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
          <Building2 className="mb-4 h-12 w-12 text-slate-300" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">Primero crea una sede</p>
          <Link href="/scheduling/sedes" className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Ir a Sedes
          </Link>
        </div>
      ) : activeServices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
          <CheckSquare className="mb-4 h-12 w-12 text-slate-300" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">No hay servicios activos</p>
          <Link href="/scheduling/services" className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Agregar servicios
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Sección 1: Datos básicos */}
          <SectionCard title="Datos básicos">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelCls}>Nombre completo (display) *</label>
                <div className="relative">
                  <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className={`${inputCls} pl-10`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Camila Rojas" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Nombre *</label>
                <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Apellido paterno *</label>
                <input className={inputCls} value={paternalLastName} onChange={(e) => setPaternalLastName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Apellido materno *</label>
                <input className={inputCls} value={maternalLastName} onChange={(e) => setMaternalLastName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Fecha nacimiento *</label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="date" className={`${inputCls} pl-10`} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Fecha ingreso *</label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="date" className={`${inputCls} pl-10`} value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Dirección *</label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className={`${inputCls} pl-10`} value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Sección 2: Contacto */}
          <SectionCard title="Contacto e invitación">
            <div className="mb-3 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
              Se enviará un enlace de invitación al correo para que la persona cree su contraseña.
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Correo electrónico *</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className={`${inputCls} pl-10`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@ejemplo.cl" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Celular *</label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className={`${inputCls} pl-10`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9 1234 5678" />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Sección 3: Sucursales */}
          <SectionCard title="Sucursales donde atiende">
            <p className="mb-3 text-xs text-slate-500">Al menos una sucursal requerida.</p>
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => {
                const checked = branchIds.includes(b.id);
                return (
                  <label
                    key={b.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                      checked
                        ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                    } ${!b.is_active ? "opacity-40" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      disabled={!b.is_active}
                      onChange={(e) => setBranchIds((prev) => toggleId(prev, b.id, e.target.checked))}
                    />
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className={b.is_active ? "" : "line-through"}>{b.name}</span>
                    {checked && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                  </label>
                );
              })}
            </div>
          </SectionCard>

          {/* Sección 4: Servicios y comisiones */}
          <SectionCard title="Servicios y comisión % por servicio">
            <p className="mb-4 text-xs text-slate-500">Porcentaje entre 0 y 100 sobre el cobro de cada servicio completado. Al menos uno requerido.</p>
            <div className="max-h-[min(52vh,480px)] space-y-5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              {servicesByCategory.map(([cat, rows]) => (
                <div key={cat}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{cat}</p>
                  <ul className="space-y-2">
                    {rows.map((s) => {
                      const checked = serviceIds.includes(s.id);
                      return (
                        <li
                          key={s.id}
                          className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                            checked
                              ? "border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-900/10"
                              : "border-transparent bg-white dark:bg-slate-900/50"
                          }`}
                        >
                          <label className="flex min-w-[160px] flex-1 cursor-pointer items-center gap-2.5 text-sm">
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={(e) => setServiceIds((prev) => toggleId(prev, s.id, e.target.checked))}
                            />
                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${checked ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"}`}>
                              {checked && <span className="text-[10px] font-bold text-white">✓</span>}
                            </div>
                            <span className="text-slate-800 dark:text-slate-200">{s.name}</span>
                          </label>
                          {checked && (
                            <label className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="font-medium">Comisión %</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                                value={commissionByService[s.id] ?? "0"}
                                onChange={(e) =>
                                  setCommissionByService((prev) => ({ ...prev, [s.id]: e.target.value }))
                                }
                              />
                            </label>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Sección 5: Comisión productos */}
          <SectionCard title="Comisión sobre productos (inventario)">
            <p className="mb-3 text-xs text-slate-500">
              Opcional. Único % para todos los productos. Dejá vacío si no aplica.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className={`${inputCls} max-w-[140px]`}
                value={productCommission}
                onChange={(e) => setProductCommission(e.target.value)}
                placeholder="Ej. 5"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
          </SectionCard>

          {/* Sección 6: Sillón / sala */}
          <SectionCard title="Sillón o sala (ocupación del local)">
            <p className="mb-3 text-xs text-slate-500">
              <strong>Fijo</strong>: siempre el mismo puesto. <strong>Dinámico</strong>: al reservar se elige un puesto libre. <strong>Sin puesto</strong>: no participa del control de sillones.
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Modo</label>
                <select
                  className={`${inputCls} max-w-md`}
                  value={stationMode}
                  onChange={(e) => {
                    setStationMode(e.target.value as "none" | "fixed" | "dynamic");
                    setStationId("");
                  }}
                >
                  <option value="none">Sin puesto asociado</option>
                  <option value="fixed">Puesto fijo</option>
                  <option value="dynamic">Dinámico</option>
                </select>
              </div>
              {stationMode === "fixed" && (
                <div>
                  <label className={labelCls}>Sillón o sala (de una sede marcada arriba)</label>
                  <select
                    className={`${inputCls} max-w-md`}
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                    disabled={branchIds.length === 0}
                  >
                    <option value="">Seleccionar…</option>
                    {stationsForPick.map((s) => {
                      const bn = branches.find((x) => x.id === s._branchId)?.name ?? "Sede";
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.kind === "room" ? "sala" : s.kind === "chair" ? "sillón" : "otro"}) — {bn}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Submit */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            Requiere correo configurado en el servidor (Resend o SMTP). Si falla el envío, no se guarda el alta.
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createProfessional.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Crear e invitar por correo
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
