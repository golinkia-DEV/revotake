"use client";

import { useMutation, useQuery, useQueryClient, useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { getStoreId } from "@/lib/store";
import { CHILE_REGIONES_COMUNAS } from "@/lib/chileRegionesComunas";
import Link from "next/link";
import { Armchair, MapPin, Plus, Save, Users } from "lucide-react";
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
      qc.invalidateQueries({ queryKey: ["scheduling-branch-stations"] });
      qc.invalidateQueries({ queryKey: ["scheduling-branch-occupancy"] });
      setNewName("");
      setNewRegion("");
      setNewComuna("");
      setNewAddress("");
    },
  });

  const patchBranch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/scheduling/branches/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-branches"] });
      qc.invalidateQueries({ queryKey: ["scheduling-branch-stations"] });
      qc.invalidateQueries({ queryKey: ["scheduling-branch-occupancy"] });
    },
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
      station_mode?: "none" | "fixed" | "dynamic";
      default_station_id?: string | null;
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
  const [newProStationMode, setNewProStationMode] = useState<"none" | "fixed" | "dynamic">("none");
  const [newProStationId, setNewProStationId] = useState("");

  const branchStationsQueries = useQueries({
    queries: (newProBranches ?? []).map((bid) => ({
      queryKey: ["scheduling-branch-stations", storeId, bid] as const,
      queryFn: () => api.get<{ items: { id: string; name: string; kind: string; branch_id: string }[] }>(`/scheduling/branches/${bid}/stations`).then((r) => r.data),
      enabled: !!storeId && newProBranches.length > 0,
    })),
  });
  const stationsForPick = branchStationsQueries.flatMap((q, i) =>
    (q.data?.items ?? []).map((s) => ({ ...s, _branchId: newProBranches[i] }))
  );

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
              storeId={storeId}
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
          <div className="mt-4 space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Puesto físico (por sede)</p>
            <p className="text-xs text-slate-500">
              <strong>Fijo</strong>: siempre el mismo sillón/sala en cada sede donde atiende (elegí uno de la lista).{" "}
              <strong>Dinámico</strong>: al reservar se asigna un puesto libre. <strong>Sin puesto</strong>: no controla ocupación de sillones.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600 dark:text-slate-400">Modo</span>
              <select
                className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={newProStationMode}
                onChange={(e) => {
                  setNewProStationMode(e.target.value as "none" | "fixed" | "dynamic");
                  setNewProStationId("");
                }}
              >
                <option value="none">Sin puesto asociado</option>
                <option value="fixed">Sillón o sala fija</option>
                <option value="dynamic">Dinámico (cualquier puesto libre)</option>
              </select>
            </label>
            {newProStationMode === "fixed" && (
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-400">Puesto (debe ser de una sede marcada arriba)</span>
                <select
                  className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  value={newProStationId}
                  onChange={(e) => setNewProStationId(e.target.value)}
                  disabled={newProBranches.length === 0}
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
              </label>
            )}
          </div>
          <button
            type="button"
            disabled={
              !newProName.trim() ||
              !newProEmail.trim().includes("@") ||
              newProPhone.trim().length < 6 ||
              newProBranches.length === 0 ||
              newProServices.length === 0 ||
              activeServices.length === 0 ||
              (newProStationMode === "fixed" && !newProStationId.trim()) ||
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
                  station_mode: newProStationMode,
                  default_station_id:
                    newProStationMode === "fixed" && newProStationId.trim() ? newProStationId.trim() : null,
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
                    setNewProStationMode("none");
                    setNewProStationId("");
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

function BranchStationsPanel({ branchId, storeId }: { branchId: string; storeId: string }) {
  const qc = useQueryClient();
  const [addName, setAddName] = useState("");
  const [addKind, setAddKind] = useState<"chair" | "room" | "other">("chair");

  const { data: stationsData } = useQuery({
    queryKey: ["scheduling-branch-stations", storeId, branchId],
    queryFn: () => api.get<{ items: { id: string; name: string; kind: string; is_active: boolean; sort_order: number }[] }>(`/scheduling/branches/${branchId}/stations`).then((r) => r.data),
    enabled: !!storeId && !!branchId,
  });

  const { data: occ } = useQuery({
    queryKey: ["scheduling-branch-occupancy", storeId, branchId],
    queryFn: () =>
      api
        .get<{
          total: number;
          occupied: number;
          available: number;
          stations: { id: string; name: string; kind: string; busy: boolean; current: { client_name: string; professional_name: string } | null }[];
        }>(`/scheduling/branches/${branchId}/stations/occupancy`)
        .then((r) => r.data),
    enabled: !!storeId && !!branchId,
    refetchInterval: 45_000,
  });

  const createSt = useMutation({
    mutationFn: () =>
      api.post(`/scheduling/branches/${branchId}/stations`, {
        name: addName.trim(),
        kind: addKind,
        sort_order: stationsData?.items?.length ?? 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-branch-stations", storeId, branchId] });
      qc.invalidateQueries({ queryKey: ["scheduling-branch-occupancy", storeId, branchId] });
      setAddName("");
      toast.success("Puesto creado");
    },
    onError: () => toast.error("No se pudo crear el puesto"),
  });

  const patchSt = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch(`/scheduling/stations/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-branch-stations", storeId, branchId] });
      qc.invalidateQueries({ queryKey: ["scheduling-branch-occupancy", storeId, branchId] });
    },
  });

  const occById = new Map((occ?.stations ?? []).map((x) => [x.id, x]));
  const items = stationsData?.items ?? [];

  return (
    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-on-surface">
        <Armchair className="h-4 w-4 text-primary" />
        Sillones y salas
        {occ != null && (
          <span className="text-xs font-normal text-slate-500">
            {occ.occupied} ocupados · {occ.available} libres ({occ.total} activos en uso)
          </span>
        )}
      </div>
      <ul className="mb-4 space-y-2 text-sm">
        {items.map((s) => {
          const live = occById.get(s.id);
          const busy = live?.busy ?? false;
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40"
            >
              <div>
                <span className="font-medium text-on-surface">{s.name}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {s.kind === "room" ? "Sala" : s.kind === "chair" ? "Sillón" : "Otro"}
                </span>
                {busy && live?.current && (
                  <span className="mt-1 block text-xs text-amber-800 dark:text-amber-200">
                    Ocupado: {live.current.client_name} · {live.current.professional_name}
                  </span>
                )}
                {!busy && s.is_active && <span className="mt-1 block text-xs text-emerald-700 dark:text-emerald-300">Libre ahora</span>}
                {!s.is_active && <span className="mt-1 block text-xs text-slate-400">Inactivo</span>}
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={() => patchSt.mutate({ id: s.id, body: { is_active: !s.is_active } })}
                disabled={patchSt.isPending}
              >
                {s.is_active ? "Desactivar" : "Activar"}
              </button>
            </li>
          );
        })}
        {items.length === 0 && <li className="text-xs text-slate-500">No hay puestos cargados. Creá uno abajo o ajustá la plantilla en Tiendas → Configuración.</li>}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-slate-500">Nuevo nombre</span>
          <input
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Ej. Sillón ventana"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-slate-500">Tipo</span>
          <select
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={addKind}
            onChange={(e) => setAddKind(e.target.value as "chair" | "room" | "other")}
          >
            <option value="chair">Sillón / puesto</option>
            <option value="room">Sala / cabina</option>
            <option value="other">Otro</option>
          </select>
        </label>
        <button
          type="button"
          disabled={!addName.trim() || createSt.isPending}
          onClick={() => createSt.mutate()}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Agregar
        </button>
      </div>
    </div>
  );
}

function BranchEditor({
  branch,
  storeId,
  onSave,
  saving,
}: {
  branch: BranchRow;
  storeId: string | null;
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
      {storeId ? <BranchStationsPanel branchId={branch.id} storeId={storeId} /> : null}
    </li>
  );
}
