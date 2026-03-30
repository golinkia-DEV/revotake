"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { getStoreId } from "@/lib/store";
import { CHILE_REGIONES_COMUNAS } from "@/lib/chileRegionesComunas";
import Link from "next/link";
import { MapPin, Plus, Save, Users } from "lucide-react";
import { toast } from "sonner";

type BranchRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  region: string | null;
  comuna: string | null;
  address_line: string | null;
  is_active: boolean;
};

type ProfessionalRow = {
  id: string;
  name: string;
  email: string | null;
  user_id: string | null;
  branch_ids: string[];
};

type ServicePick = { id: string; name: string; category: string | null; menu_sort_order: number; is_active: boolean };

const TZ_OPTIONS = ["America/Santiago", "America/Punta_Arenas", "Pacific/Easter", "UTC"];

export default function SchedulingSedesPage() {
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const qc = useQueryClient();

  const { data: branchesData, isLoading: loadingBranches } = useQuery({
    queryKey: ["scheduling-branches", storeId],
    queryFn: () => api.get("/scheduling/branches").then((r) => r.data),
    enabled: !!storeId,
  });

  const { data: professionalsData, isLoading: loadingPros } = useQuery({
    queryKey: ["scheduling-professionals", storeId],
    queryFn: () => api.get("/scheduling/professionals").then((r) => r.data),
    enabled: !!storeId,
  });

  const { data: servicesData } = useQuery({
    queryKey: ["scheduling-services", storeId],
    queryFn: () => api.get<{ items: ServicePick[] }>("/scheduling/services").then((r) => r.data),
    enabled: !!storeId,
  });

  const branches: BranchRow[] = branchesData?.items ?? [];
  const professionals: ProfessionalRow[] = professionalsData?.items ?? [];
  const activeServices = (servicesData?.items ?? []).filter((s) => s.is_active);

  const [newName, setNewName] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [newComuna, setNewComuna] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newTz, setNewTz] = useState("America/Santiago");

  const newComunas = useMemo(() => {
    const row = CHILE_REGIONES_COMUNAS.find((r) => r.region === newRegion);
    return row?.comunas ?? [];
  }, [newRegion]);

  const createBranch = useMutation({
    mutationFn: () =>
      api.post("/scheduling/branches", {
        name: newName.trim(),
        timezone: newTz,
        region: newRegion || null,
        comuna: newComuna || null,
        address_line: newAddress.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-branches"] });
      setNewName("");
      setNewRegion("");
      setNewComuna("");
      setNewAddress("");
    },
  });

  const patchBranch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/scheduling/branches/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduling-branches"] }),
  });

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
      toast.success("Invitación enviada por correo");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? String((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "")
          : "";
      toast.error(msg || "No se pudo crear el profesional");
    },
  });

  const patchProfessional = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/scheduling/professionals/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduling-professionals"] }),
  });

  const [proDraft, setProDraft] = useState<Record<string, string[]>>({});
  const [newProName, setNewProName] = useState("");
  const [newProEmail, setNewProEmail] = useState("");
  const [newProPhone, setNewProPhone] = useState("");
  const [newProBranches, setNewProBranches] = useState<string[]>([]);
  const [newProServices, setNewProServices] = useState<string[]>([]);
  const [newProServiceCommission, setNewProServiceCommission] = useState("0");
  const [newProProductCommission, setNewProProductCommission] = useState("");

  function draftBranches(p: ProfessionalRow): string[] {
    return proDraft[p.id] ?? p.branch_ids;
  }

  function toggleDraftBranch(proId: string, bid: string, checked: boolean, base: string[]) {
    const next = checked ? [...new Set([...base, bid])] : base.filter((x) => x !== bid);
    setProDraft((d) => ({ ...d, [proId]: next }));
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
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-on-surface">Sedes y equipo</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Administrá las sedes de la tienda con región y comuna (Chile). Cada profesional de la agenda puede atender en una
          o varias sedes; la reserva pública solo ofrece quienes estén asignados a la sede elegida.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/scheduling" className="font-semibold text-primary hover:underline">
            ← Volver a Citas
          </Link>
        </p>
      </div>

      <section className="mb-12 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
          <MapPin className="h-5 w-5 text-primary" /> Sedes
        </div>
        {loadingBranches && <p className="text-sm text-slate-500">Cargando…</p>}
        <ul className="mb-8 space-y-4">
          {branches.map((b) => (
            <BranchEditor
              key={b.id}
              branch={b}
              onSave={(body) => patchBranch.mutate({ id: b.id, body })}
              saving={patchBranch.isPending}
            />
          ))}
        </ul>

        <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
          <div className="mb-3 flex items-center gap-2 font-semibold text-on-surface">
            <Plus className="h-4 w-4" /> Nueva sede
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600 dark:text-slate-400">Nombre</span>
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej. Local Providencia"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600 dark:text-slate-400">Zona horaria</span>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={newTz}
                onChange={(e) => setNewTz(e.target.value)}
              >
                {TZ_OPTIONS.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600 dark:text-slate-400">Región</span>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={newRegion}
                onChange={(e) => {
                  setNewRegion(e.target.value);
                  setNewComuna("");
                }}
              >
                <option value="">Seleccionar…</option>
                {CHILE_REGIONES_COMUNAS.map((r) => (
                  <option key={r.region} value={r.region}>
                    {r.region}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600 dark:text-slate-400">Comuna</span>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={newComuna}
                onChange={(e) => setNewComuna(e.target.value)}
                disabled={!newRegion}
              >
                <option value="">{newRegion ? "Seleccionar…" : "Primero elige región"}</option>
                {newComunas.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-slate-600 dark:text-slate-400">Dirección (calle, número)</span>
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Opcional · visible en reserva pública"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={!newName.trim() || createBranch.isPending}
            onClick={() => createBranch.mutate()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> Crear sede
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
          <Users className="h-5 w-5 text-primary" /> Profesionales y sedes donde atienden
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Marcá todas las sedes en las que trabaja cada persona. Para dar de alta con selección clara de servicios, usá{" "}
          <Link href="/scheduling/profesionales" className="font-semibold text-primary hover:underline">
            Crear profesional
          </Link>{" "}
          en el menú. Para vincular a un usuario (Mi agenda), usá la API{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">PATCH /scheduling/professionals/&#123;id&#125;</code>{" "}
          con <code className="rounded bg-slate-100 px-1">user_id</code>.
        </p>
        {loadingPros && <p className="text-sm text-slate-500">Cargando…</p>}
        <ul className="space-y-6">
          {professionals.map((p) => {
            const selected = draftBranches(p);
            return (
              <li
                key={p.id}
                className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"
              >
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-on-surface">{p.name}</span>
                  {p.email && <span className="text-xs text-slate-500">{p.email}</span>}
                </div>
                <div className="flex flex-wrap gap-3">
                  {branches.map((b) => (
                    <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={selected.includes(b.id)}
                        disabled={!b.is_active}
                        onChange={(e) => toggleDraftBranch(p.id, b.id, e.target.checked, selected)}
                      />
                      <span className={b.is_active ? "" : "text-slate-400 line-through"}>{b.name}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-3 text-sm font-semibold text-primary hover:underline"
                  disabled={patchProfessional.isPending}
                  onClick={() => {
                    const ids = proDraft[p.id] ?? p.branch_ids;
                    patchProfessional.mutate({
                      id: p.id,
                      body: { branch_ids: ids },
                    });
                    setProDraft((d) => {
                      const next = { ...d };
                      delete next[p.id];
                      return next;
                    });
                  }}
                >
                  Guardar sedes de {p.name.split(" ")[0]}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
          <div className="mb-3 font-semibold text-on-surface">Agregar profesional</div>
          <p className="mb-3 text-xs text-slate-500">
            Mismo flujo que <Link href="/scheduling/profesionales" className="font-semibold text-primary hover:underline">Crear profesional</Link>: correo + celular, invitación por correo (Resend o SMTP) y comisiones. Comisión de servicios se aplica igual a todos los servicios marcados abajo.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Nombre *"
              value={newProName}
              onChange={(e) => setNewProName(e.target.value)}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              type="email"
              placeholder="Correo *"
              value={newProEmail}
              onChange={(e) => setNewProEmail(e.target.value)}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 md:col-span-2"
              placeholder="Celular *"
              value={newProPhone}
              onChange={(e) => setNewProPhone(e.target.value)}
            />
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block text-slate-600 dark:text-slate-400">Comisión % (todos los servicios marcados)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={newProServiceCommission}
                onChange={(e) => setNewProServiceCommission(e.target.value)}
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block text-slate-600 dark:text-slate-400">Comisión productos % (opcional, único para todos)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={newProProductCommission}
                onChange={(e) => setNewProProductCommission(e.target.value)}
                placeholder="Vacío = sin comisión productos"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">Sedes donde atiende (al menos una):</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {branches.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={newProBranches.includes(b.id)}
                  disabled={!b.is_active}
                  onChange={(e) =>
                    setNewProBranches((prev) =>
                      e.target.checked ? [...prev, b.id] : prev.filter((x) => x !== b.id)
                    )
                  }
                />
                {b.name}
              </label>
            ))}
          </div>
          {activeServices.length > 0 && (
            <>
              <p className="mt-4 text-xs text-slate-500">Servicios del menú que ofrece (al menos uno):</p>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                <ul className="grid gap-1 sm:grid-cols-2">
                  {activeServices.map((s) => (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={newProServices.includes(s.id)}
                          onChange={(e) =>
                            setNewProServices((prev) =>
                              e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                            )
                          }
                        />
                        {s.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          <button
            type="button"
            disabled={
              !newProName.trim() ||
              !newProEmail.trim().includes("@") ||
              newProPhone.trim().length < 6 ||
              newProBranches.length === 0 ||
              newProServices.length === 0 ||
              activeServices.length === 0 ||
              createProfessional.isPending
            }
            onClick={() => {
              const pct = parseFloat(newProServiceCommission) || 0;
              const service_commissions: Record<string, number> = {};
              for (const sid of newProServices) {
                service_commissions[sid] = pct;
              }
              let product_commission_percent: number | null = null;
              if (newProProductCommission.trim() !== "") {
                const p = parseFloat(newProProductCommission.replace(",", "."));
                if (!Number.isNaN(p) && p >= 0 && p <= 100) product_commission_percent = p;
              }
              createProfessional.mutate(
                {
                  name: newProName.trim(),
                  email: newProEmail.trim(),
                  phone: newProPhone.trim(),
                  branch_ids: newProBranches,
                  service_ids: newProServices,
                  service_commissions,
                  product_commission_percent,
                },
                {
                  onSuccess: () => {
                    setNewProName("");
                    setNewProEmail("");
                    setNewProPhone("");
                    setNewProBranches([]);
                    setNewProServices([]);
                    setNewProServiceCommission("0");
                    setNewProProductCommission("");
                  },
                }
              );
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
          >
            <Plus className="h-4 w-4" /> Crear profesional
          </button>
        </div>
      </section>
    </AppLayout>
  );
}

function BranchEditor({
  branch,
  onSave,
  saving,
}: {
  branch: BranchRow;
  onSave: (body: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(branch.name);
  const [slug, setSlug] = useState(branch.slug);
  const [tz, setTz] = useState(branch.timezone || "America/Santiago");
  const [region, setRegion] = useState(branch.region || "");
  const [comuna, setComuna] = useState(branch.comuna || "");
  const [address, setAddress] = useState(branch.address_line || "");
  const [active, setActive] = useState(branch.is_active);

  useEffect(() => {
    setName(branch.name);
    setSlug(branch.slug);
    setTz(branch.timezone || "America/Santiago");
    setRegion(branch.region || "");
    setComuna(branch.comuna || "");
    setAddress(branch.address_line || "");
    setActive(branch.is_active);
  }, [
    branch.id,
    branch.name,
    branch.slug,
    branch.timezone,
    branch.region,
    branch.comuna,
    branch.address_line,
    branch.is_active,
  ]);

  const comunas = useMemo(() => {
    const row = CHILE_REGIONES_COMUNAS.find((r) => r.region === region);
    return row?.comunas ?? [];
  }, [region]);

  return (
    <li className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Nombre</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Slug URL</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Zona horaria</span>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
          >
            {TZ_OPTIONS.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Sede activa (visible en reserva pública)
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Región</span>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setComuna("");
            }}
          >
            <option value="">—</option>
            {CHILE_REGIONES_COMUNAS.map((r) => (
              <option key={r.region} value={r.region}>
                {r.region}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Comuna</span>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={comuna}
            onChange={(e) => setComuna(e.target.value)}
            disabled={!region}
          >
            <option value="">{region ? "Seleccionar…" : "Región primero"}</option>
            {comunas.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block text-slate-500">Dirección</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={saving || !name.trim()}
        onClick={() =>
          onSave({
            name: name.trim(),
            slug: slug.trim(),
            timezone: tz,
            region: region || null,
            comuna: comuna || null,
            address_line: address.trim() || null,
            is_active: active,
          })
        }
        className="mt-3 text-sm font-semibold text-primary hover:underline disabled:opacity-50"
      >
        Guardar cambios
      </button>
    </li>
  );
}
