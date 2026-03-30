"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Loader2,
  MapPin,
  Clock,
  Car,
  AlertCircle,
  Bell,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { fileUrl } from "@/lib/files";
import Link from "next/link";
import { listSelectedAmenityEntries, mergeStoreProfileFromApi } from "@/lib/storeProfile";
import { AMENITY_ICONS } from "@/lib/amenityIcons";

const publicApi = axios.create({ baseURL: API_URL });

const PARK_LABELS: Record<string, string> = {
  no: "Sin estacionamiento",
  si_gratis: "Estacionamiento gratuito",
  si_pago: "Estacionamiento de pago",
  limitado: "Estacionamiento limitado",
};

type ServiceItem = {
  id: string;
  name: string;
  category?: string | null;
  menu_sort_order?: number;
  image_urls?: string[];
  description?: string;
  duration_minutes: number;
  price_cents: number;
  currency: string;
  deposit_required_cents: number;
  cancellation_hours: number;
  cancellation_fee_cents: number;
  intake_form_schema: IntakeField[];
};

const PUB_GENERAL = "__general__";

function pubCategoryKey(c: string | null | undefined) {
  const t = (c || "").trim();
  return t ? t : PUB_GENERAL;
}

type IntakeField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "boolean";
  required?: boolean;
  options?: string[];
};

function formatPrice(cents: number, currency: string) {
  if (cents === 0) return "Gratis";
  return `${(cents / 100).toLocaleString("es-CL")} ${currency}`;
}

function StarsBlock({
  average,
  count,
  className = "",
}: {
  average: number | null | undefined;
  count: number;
  className?: string;
}) {
  if (!count || average == null) return null;
  const filled = Math.min(5, Math.max(0, Math.round(average)));
  const label = `${average.toFixed(1)} de 5 estrellas, ${count} ${count === 1 ? "opinión" : "opiniones"}`;
  return (
    <div className={className} role="img" aria-label={label}>
      <div className="flex items-center justify-center gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={
              i < filled ? "text-lg text-amber-500" : "text-lg text-slate-200 dark:text-slate-600"
            }
          >
            ★
          </span>
        ))}
      </div>
      <p className="mt-1 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
        {average.toFixed(1)} · {count} {count === 1 ? "opinión" : "opiniones"}
      </p>
    </div>
  );
}

function StarsInline({ average, count }: { average: number | null | undefined; count: number }) {
  if (!count || average == null) {
    return <span className="text-[11px] text-slate-400">Sin calificaciones</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-amber-500" title={`${average.toFixed(1)} / 5 (${count})`}>
      <span className="text-sm">★</span>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{average.toFixed(1)}</span>
      <span className="text-[10px] text-slate-400">({count})</span>
    </span>
  );
}

function CancellationPolicyBadge({ hours, feeCents, currency }: { hours: number; feeCents: number; currency: string }) {
  if (!hours) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Cancelación gratuita hasta {hours}h antes.
        {feeCents > 0 && ` Cargo por cancelación tardía: ${formatPrice(feeCents, currency)}.`}
      </span>
    </div>
  );
}

function PublicPlaceInfo({
  loc,
  ho,
  am,
}: {
  loc: Record<string, string>;
  ho: Record<string, string>;
  am: Record<string, unknown>;
}) {
  const park = String(am.estacionamiento || "");
  const parkPlazas = String(am.estacionamiento_plazas ?? "").trim();
  const showParkPlazas =
    (park === "si_gratis" || park === "limitado") && parkPlazas.length > 0 && /^\d+$/.test(parkPlazas);
  const amenityEntries = listSelectedAmenityEntries(mergeStoreProfileFromApi({ amenities: am }).amenities);
  return (
    <div className="space-y-3 text-slate-700 dark:text-slate-200">
      {(loc.direccion_atencion || loc.comuna) && (
        <div className="flex gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div>
            <p className="font-medium">{[loc.direccion_atencion, loc.comuna, loc.region].filter(Boolean).join(", ")}</p>
            {loc.referencias_acceso && <p className="mt-1 text-xs text-slate-500">{loc.referencias_acceso}</p>}
            {loc.google_maps_url && (
              <a
                href={loc.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-blue-600 hover:underline"
              >
                Ver en mapa
              </a>
            )}
          </div>
        </div>
      )}
      {(ho.lun_vie || ho.sabado || ho.domingo_feriados) && (
        <div className="flex gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div className="text-xs">
            {ho.lun_vie && (
              <p>
                <span className="font-semibold">Lun–Vie:</span> {ho.lun_vie}
              </p>
            )}
            {ho.sabado && (
              <p>
                <span className="font-semibold">Sáb:</span> {ho.sabado}
              </p>
            )}
            {ho.domingo_feriados && (
              <p>
                <span className="font-semibold">Dom / feriados:</span> {ho.domingo_feriados}
              </p>
            )}
            {ho.notas && <p className="mt-1 text-slate-500">{ho.notas}</p>}
          </div>
        </div>
      )}
      {park && park !== "no" && (
        <div className="flex gap-2">
          <Car className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <p className="text-xs">
            <span className="font-semibold">{PARK_LABELS[park] ?? park}</span>
            {showParkPlazas
              ? ` · aprox. ${parkPlazas} ${parkPlazas === "1" ? "plaza" : "plazas"}`
              : ""}
            {am.estacionamiento_detalle ? ` · ${am.estacionamiento_detalle}` : ""}
          </p>
        </div>
      )}
      {amenityEntries.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {amenityEntries.map(({ key, label }) => {
            const Icon = AMENITY_ICONS[key];
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-2 pr-2.5 font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-100"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
                {label}
              </span>
            );
          })}
        </div>
      )}
      {typeof am.otras_comodidades === "string" && am.otras_comodidades.trim() && (
        <p className="text-xs text-slate-600 dark:text-slate-300">{am.otras_comodidades}</p>
      )}
    </div>
  );
}

type Step = 1 | 2 | 3 | 4 | 5;

export default function PublicBookPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [step, setStep] = useState<Step>(1);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [onDate, setOnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({});
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [svcSearch, setSvcSearch] = useState("");
  const [svcFilterCat, setSvcFilterCat] = useState<string | "__all__">("__all__");
  const [svcOpenCats, setSvcOpenCats] = useState<Record<string, boolean>>({});

  const meta = useQuery({
    queryKey: ["pub-meta", slug],
    queryFn: () => publicApi.get(`/public/scheduling/${slug}/meta`).then((r) => r.data),
    enabled: !!slug,
  });
  const ratings = useQuery({
    queryKey: ["pub-ratings", slug],
    queryFn: () => publicApi.get(`/public/scheduling/${slug}/ratings-summary`).then((r) => r.data),
    enabled: !!slug,
  });
  const services = useQuery({
    queryKey: ["pub-svc", slug],
    queryFn: () => publicApi.get(`/public/scheduling/${slug}/services`).then((r) => r.data),
    enabled: !!slug,
  });
  const branches = useQuery({
    queryKey: ["pub-br", slug],
    queryFn: () => publicApi.get(`/public/scheduling/${slug}/branches`).then((r) => r.data),
    enabled: !!slug,
  });
  const professionals = useQuery({
    queryKey: ["pub-pr", slug, branchId, serviceId],
    queryFn: () =>
      publicApi
        .get(`/public/scheduling/${slug}/professionals`, {
          params: { branch_id: branchId, service_id: serviceId },
        })
        .then((r) => r.data),
    enabled: !!slug && !!branchId && !!serviceId,
  });
  const slots = useQuery({
    queryKey: ["pub-slots", slug, branchId, professionalId, serviceId, onDate],
    queryFn: () =>
      publicApi
        .get(`/public/scheduling/${slug}/slots`, {
          params: {
            branch_id: branchId,
            professional_id: professionalId,
            service_id: serviceId,
            on_date: onDate,
          },
        })
        .then((r) => r.data),
    enabled: !!slug && !!branchId && !!professionalId && !!serviceId && !!onDate,
  });

  const selectedService: ServiceItem | undefined = useMemo(
    () => services.data?.items?.find((s: ServiceItem) => s.id === serviceId),
    [services.data, serviceId]
  );

  const pubItems: ServiceItem[] = services.data?.items ?? [];

  const pubCategoryChips = useMemo(() => {
    const set = new Set<string>();
    for (const s of pubItems) {
      const t = (s.category || "").trim();
      if (t) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [pubItems]);

  const pubFiltered = useMemo(() => {
    const q = svcSearch.trim().toLowerCase();
    return pubItems.filter((s) => {
      if (svcFilterCat !== "__all__") {
        const k = pubCategoryKey(s.category);
        if (svcFilterCat === PUB_GENERAL) {
          if (k !== PUB_GENERAL) return false;
        } else if ((s.category || "").trim() !== svcFilterCat) {
          return false;
        }
      }
      if (!q) return true;
      const blob = `${s.name} ${s.description || ""} ${s.category || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [pubItems, svcSearch, svcFilterCat]);

  const pubGrouped = useMemo(() => {
    const m = new Map<string, ServiceItem[]>();
    for (const s of pubFiltered) {
      const k = pubCategoryKey(s.category);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    const keys = Array.from(m.keys()).sort((a, b) => {
      if (a === PUB_GENERAL) return -1;
      if (b === PUB_GENERAL) return 1;
      return a.localeCompare(b, "es");
    });
    return keys.map((k) => ({
      key: k,
      title: k === PUB_GENERAL ? "Servicios" : k,
      rows: m.get(k)!,
    }));
  }, [pubFiltered]);

  const pubCatOpen = (key: string) => svcOpenCats[key] !== false;
  const togglePubCat = (key: string) => {
    setSvcOpenCats((o) => ({ ...o, [key]: o[key] === false ? true : false }));
  };

  const book = useMutation({
    mutationFn: () =>
      publicApi.post(`/public/scheduling/${slug}/bookings`, {
        branch_id: branchId,
        professional_id: professionalId,
        service_id: serviceId,
        start_time: slotStart,
        payment_mode: "on_site",
        client_name: clientName,
        client_email: clientEmail || null,
        client_phone: clientPhone || null,
        intake_answers: Object.keys(intakeAnswers).length > 0 ? intakeAnswers : null,
      }),
    onSuccess: (res) => {
      toast.success("¡Cita registrada!");
      window.location.href = `/book/manage/${res.data.manage_token}`;
    },
    onError: (e: unknown) => {
      const msg = axios.isAxiosError(e) ? e.response?.data?.detail : "Error al reservar";
      toast.error(typeof msg === "string" ? msg : "No se pudo completar la reserva");
    },
  });

  const joinWaitlist = useMutation({
    mutationFn: () =>
      publicApi.post(`/public/scheduling/${slug}/waitlist`, {
        professional_id: professionalId,
        service_id: serviceId,
        branch_id: branchId,
        desired_date: onDate,
        client_name: clientName || "Cliente",
        client_email: clientEmail || null,
        client_phone: clientPhone || null,
      }),
    onSuccess: () => {
      setWaitlistJoined(true);
      toast.success("¡Anotado en lista de espera! Te avisaremos si hay disponibilidad.");
    },
    onError: () => toast.error("No se pudo unirse a la lista de espera"),
  });

  const hasIntakeForm = (selectedService?.intake_form_schema?.length ?? 0) > 0;
  const noSlotsAvailable = slots.data && slots.data.slots?.length === 0 && !slots.isLoading;

  if (meta.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <p className="text-slate-600">Tienda no encontrada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="mb-8 text-center">
          {meta.data?.logo_url ? (
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900">
              <img src={fileUrl(meta.data.logo_url)} alt="" className="max-h-full max-w-full object-contain p-1" />
            </div>
          ) : (
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
              <Calendar className="h-7 w-7" />
            </div>
          )}
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {meta.data?.name ?? "Reservar"}
          </h1>
          {ratings.data?.store && ratings.data.store.count > 0 && ratings.data.store.average != null && (
            <StarsBlock average={ratings.data.store.average} count={ratings.data.store.count} className="mt-3" />
          )}
          <p className="mt-2 text-sm text-slate-500">Elegí servicio, sucursal, profesional y horario.</p>
        </div>

        {meta.data?.public &&
          (() => {
            const pub = meta.data.public as {
              location_public?: Record<string, string>;
              horarios?: Record<string, string>;
              amenities?: Record<string, unknown>;
            };
            const loc = pub.location_public || {};
            const ho = pub.horarios || {};
            const am = pub.amenities || {};
            const mergedAmenities = mergeStoreProfileFromApi({ amenities: am }).amenities;
            const hasInfo =
              Boolean(loc.direccion_atencion || loc.comuna || loc.referencias_acceso || loc.google_maps_url) ||
              Boolean(ho.lun_vie || ho.sabado || ho.domingo_feriados || ho.notas) ||
              Boolean(am.estacionamiento && am.estacionamiento !== "no") ||
              listSelectedAmenityEntries(mergedAmenities).length > 0 ||
              (typeof am.otras_comodidades === "string" && am.otras_comodidades.trim().length > 0);
            if (!hasInfo) return null;
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Sobre este lugar</p>
                <PublicPlaceInfo loc={loc} ho={ho} am={am} />
              </motion.div>
            );
          })()}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">1. Servicio</h2>
              {services.isLoading && <Loader2 className="h-6 w-6 animate-spin text-blue-600" />}
              {!services.isLoading && pubItems.length > 0 && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={svcSearch}
                      onChange={(e) => setSvcSearch(e.target.value)}
                      placeholder="¿Qué servicio buscás?"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button
                      type="button"
                      onClick={() => setSvcFilterCat("__all__")}
                      className={
                        svcFilterCat === "__all__"
                          ? "shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                          : "shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }
                    >
                      Todos
                    </button>
                    {pubItems.some((s) => !((s.category || "").trim())) && (
                      <button
                        type="button"
                        onClick={() => setSvcFilterCat(PUB_GENERAL)}
                        className={
                          svcFilterCat === PUB_GENERAL
                            ? "shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                            : "shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        }
                      >
                        General
                      </button>
                    )}
                    {pubCategoryChips.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSvcFilterCat(c)}
                        className={
                          svcFilterCat === c
                            ? "shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                            : "shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        }
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="space-y-2">
                {!services.isLoading && pubItems.length === 0 && (
                  <p className="text-center text-sm text-slate-500">No hay servicios disponibles por ahora.</p>
                )}
                {!services.isLoading && pubItems.length > 0 && pubFiltered.length === 0 && (
                  <p className="text-center text-sm text-slate-500">No hay servicios que coincidan.</p>
                )}
                {pubGrouped.map(({ key, title, rows }) => (
                  <div
                    key={key}
                    className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                  >
                    <button
                      type="button"
                      onClick={() => togglePubCat(key)}
                      className="flex w-full items-center justify-between gap-2 bg-slate-50/90 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
                    >
                      {title}
                      <span className="flex items-center gap-1 font-normal normal-case text-slate-400">
                        {rows.length}
                        {pubCatOpen(key) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                    </button>
                    {pubCatOpen(key) && (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {rows.map((s: ServiceItem) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setServiceId(s.id);
                              setIntakeAnswers({});
                              setStep(2);
                            }}
                            className="flex w-full flex-col gap-1 px-4 py-3 text-left text-sm transition hover:bg-blue-50/80 dark:hover:bg-slate-800/80"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-3">
                                {s.image_urls?.[0] && (
                                  <img
                                    src={fileUrl(s.image_urls[0])}
                                    alt=""
                                    className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-600"
                                  />
                                )}
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  {s.name}{" "}
                                  <span className="font-normal text-slate-400">({s.duration_minutes} min)</span>
                                </span>
                              </div>
                              <span className="shrink-0 font-semibold text-blue-700 dark:text-blue-400">
                                {formatPrice(s.price_cents, s.currency)}
                              </span>
                            </div>
                            {s.description && (
                              <p className="text-xs text-slate-500 line-clamp-2">{s.description}</p>
                            )}
                            {s.deposit_required_cents > 0 && (
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                Depósito al reservar: {formatPrice(s.deposit_required_cents, s.currency)}
                              </p>
                            )}
                            {s.cancellation_hours > 0 && (
                              <p className="text-xs text-amber-600 dark:text-amber-400">
                                Cancelación gratuita hasta {s.cancellation_hours}h antes
                                {s.cancellation_fee_cents > 0 &&
                                  ` · cargo tardío: ${formatPrice(s.cancellation_fee_cents, s.currency)}`}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">2. Sucursal</h2>
              <div className="space-y-2">
                {branches.data?.items?.map(
                  (b: {
                    id: string;
                    name: string;
                    comuna?: string | null;
                    region?: string | null;
                    address_line?: string | null;
                  }) => {
                    const loc = [b.comuna, b.region].filter(Boolean).join(" · ");
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setBranchId(b.id);
                          setStep(3);
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium transition hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{b.name}</span>
                          {loc && (
                            <span className="mt-0.5 block truncate text-xs font-normal text-slate-500">{loc}</span>
                          )}
                          {b.address_line && (
                            <span className="mt-0.5 block truncate text-xs font-normal text-slate-400">
                              {b.address_line}
                            </span>
                          )}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      </button>
                    );
                  }
                )}
              </div>
              <button type="button" onClick={() => setStep(1)} className="text-sm text-blue-600 hover:underline">
                Volver
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">3. Profesional</h2>
              {professionals.isLoading && <Loader2 className="h-6 w-6 animate-spin text-blue-600" />}
              {professionals.data?.items?.length === 0 && !professionals.isLoading && (
                <p className="text-sm text-amber-700">No hay profesionales para esta combinación.</p>
              )}
              <div className="space-y-2">
                {professionals.data?.items?.map(
                  (p: {
                    id: string;
                    name: string;
                    rating_average?: number | null;
                    rating_count?: number;
                  }) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setProfessionalId(p.id);
                        setStep(4);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium transition hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{p.name}</span>
                        <span className="mt-0.5 block">
                          <StarsInline average={p.rating_average ?? null} count={p.rating_count ?? 0} />
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  )
                )}
              </div>
              <button type="button" onClick={() => setStep(2)} className="text-sm text-blue-600 hover:underline">
                Volver
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">4. Fecha y hora</h2>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Fecha</label>
                <input
                  type="date"
                  value={onDate}
                  onChange={(e) => {
                    setOnDate(e.target.value);
                    setSlotStart(null);
                    setWaitlistJoined(false);
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              {slots.isLoading && <Loader2 className="h-6 w-6 animate-spin text-blue-600" />}
              <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {slots.data?.slots?.map((iso: string) => (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => {
                      setSlotStart(iso);
                      setStep(5);
                    }}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium ${
                      slotStart === iso
                        ? "border-blue-600 bg-blue-50 text-blue-800"
                        : "border-slate-200 hover:border-blue-400 dark:border-slate-700"
                    }`}
                  >
                    {new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                  </button>
                ))}
              </div>

              {noSlotsAvailable && !waitlistJoined && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    No hay horarios disponibles ese día.
                  </p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    ¿Quieres que te avisemos si se libera un espacio?
                  </p>
                  <div className="mt-3 space-y-2">
                    <input
                      className="w-full rounded-lg border border-amber-200 px-3 py-2 text-xs dark:border-amber-800 dark:bg-slate-900"
                      placeholder="Tu nombre"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                    <input
                      type="email"
                      className="w-full rounded-lg border border-amber-200 px-3 py-2 text-xs dark:border-amber-800 dark:bg-slate-900"
                      placeholder="Email para notificarte"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={!clientName.trim() || !clientEmail.trim() || joinWaitlist.isPending}
                      onClick={() => joinWaitlist.mutate()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {joinWaitlist.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Bell className="h-3.5 w-3.5" />
                      )}
                      Avisarme si hay disponibilidad
                    </button>
                  </div>
                </div>
              )}

              {waitlistJoined && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
                  ✓ Anotado en lista de espera. Te enviaremos un email si se libera un espacio.
                </div>
              )}

              {!noSlotsAvailable && slots.data?.slots?.length === 0 && slots.isLoading === false && null}
              <button type="button" onClick={() => setStep(3)} className="text-sm text-blue-600 hover:underline">
                Volver
              </button>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">5. Tus datos</h2>
              <p className="text-xs text-slate-500">
                {selectedService?.name} · {new Date(slotStart || "").toLocaleString("es-CL")}
              </p>

              {selectedService && (
                <CancellationPolicyBadge
                  hours={selectedService.cancellation_hours}
                  feeCents={selectedService.cancellation_fee_cents}
                  currency={selectedService.currency}
                />
              )}

              {selectedService && selectedService.deposit_required_cents > 0 && (
                <div className="rounded-lg bg-blue-50 p-2.5 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  Se requiere depósito de {formatPrice(selectedService.deposit_required_cents, selectedService.currency)} al llegar.
                </div>
              )}

              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                placeholder="Nombre *"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                placeholder="Email (para recordatorios)"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                placeholder="Teléfono"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
              />

              {hasIntakeForm && (
                <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Información del servicio
                  </p>
                  {selectedService!.intake_form_schema.map((field) => (
                    <div key={field.id}>
                      <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                        {field.label}
                        {field.required && <span className="ml-1 text-red-500">*</span>}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                          value={intakeAnswers[field.id] || ""}
                          onChange={(e) =>
                            setIntakeAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                          }
                        />
                      ) : field.type === "select" ? (
                        <select
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                          value={intakeAnswers[field.id] || ""}
                          onChange={(e) =>
                            setIntakeAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                          }
                        >
                          <option value="">Seleccionar…</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                          value={intakeAnswers[field.id] || ""}
                          onChange={(e) =>
                            setIntakeAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!clientName.trim() || !slotStart || book.isPending}
                  onClick={() => book.mutate()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {book.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar reserva
                </button>
                <button type="button" onClick={() => setStep(4)} className="rounded-xl border px-4 py-3 text-sm">
                  Volver
                </button>
              </div>
            </div>
          )}
        </motion.div>

        <p className="mt-8 text-center text-xs text-slate-400">
          <Link href="/login" className="hover:text-slate-600">
            Acceso equipo
          </Link>
        </p>
      </div>
    </div>
  );
}
