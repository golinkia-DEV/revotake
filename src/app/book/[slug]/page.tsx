"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Calendar, ChevronRight, Loader2, MapPin, Clock, Coffee, Wifi, Car } from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import Link from "next/link";

const publicApi = axios.create({ baseURL: API_URL });

const PARK_LABELS: Record<string, string> = {
  no: "Sin estacionamiento",
  si_gratis: "Estacionamiento gratuito",
  si_pago: "Estacionamiento de pago",
  limitado: "Estacionamiento limitado",
};

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
            {am.estacionamiento_detalle ? ` · ${am.estacionamiento_detalle}` : ""}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        {Boolean(am.cafeteria) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <Coffee className="h-3 w-3" /> Café / bebidas
          </span>
        )}
        {Boolean(am.wifi) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
            <Wifi className="h-3 w-3" /> Wi‑Fi
          </span>
        )}
        {Boolean(am.sala_espera) && <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">Sala de espera</span>}
        {Boolean(am.acceso_movilidad) && <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">Acceso movilidad</span>}
      </div>
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
  const [onDate, setOnDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  const meta = useQuery({
    queryKey: ["pub-meta", slug],
    queryFn: () => publicApi.get(`/public/scheduling/${slug}/meta`).then((r) => r.data),
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
      }),
    onSuccess: (res) => {
      const token = res.data.manage_token;
      toast.success("Cita registrada");
      window.location.href = `/book/manage/${token}`;
    },
    onError: (e: unknown) => {
      const msg = axios.isAxiosError(e) ? e.response?.data?.detail : "Error al reservar";
      toast.error(typeof msg === "string" ? msg : "No se pudo completar la reserva");
    },
  });

  const selectedService = useMemo(
    () => services.data?.items?.find((s: { id: string }) => s.id === serviceId),
    [services.data, serviceId]
  );

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
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
            <Calendar className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {meta.data?.name ?? "Reservar"}
          </h1>
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
            const hasInfo =
              Boolean(loc.direccion_atencion || loc.comuna || loc.referencias_acceso || loc.google_maps_url) ||
              Boolean(ho.lun_vie || ho.sabado || ho.domingo_feriados || ho.notas) ||
              Boolean(am.estacionamiento && am.estacionamiento !== "no") ||
              Boolean(am.cafeteria || am.wifi || am.sala_espera || am.acceso_movilidad) ||
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
            <div className="space-y-3">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">1. Servicio</h2>
              {services.isLoading && <Loader2 className="h-6 w-6 animate-spin text-blue-600" />}
              <div className="space-y-2">
                {services.data?.items?.map((s: { id: string; name: string; duration_minutes: number }) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setServiceId(s.id);
                      setStep(2);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium transition hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <span>
                      {s.name} <span className="text-slate-400">({s.duration_minutes} min)</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">2. Sucursal</h2>
              <div className="space-y-2">
                {branches.data?.items?.map((b: { id: string; name: string }) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setBranchId(b.id);
                      setStep(3);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium transition hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {b.name}
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                ))}
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
                {professionals.data?.items?.map((p: { id: string; name: string }) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProfessionalId(p.id);
                      setStep(4);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium transition hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {p.name}
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                ))}
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
              {slots.data?.slots?.length === 0 && !slots.isLoading && (
                <p className="text-sm text-slate-500">No hay horarios disponibles ese día.</p>
              )}
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
