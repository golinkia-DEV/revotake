"use client";

import { useState } from "react";
import { FileText, MapPin, Clock, Coffee, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import clsx from "clsx";
import type {
  FiscalChile,
  LocationPublic,
  HorariosTienda,
  Amenities,
  EstacionamientoTipo,
} from "@/lib/storeProfile";
import { AMENITIES_EXTENDED_DEFS, AMENITIES_QUICK_KEYS } from "@/lib/storeProfile";

export function FiscalChileStep({ value, onChange }: { value: FiscalChile; onChange: (v: FiscalChile) => void }) {
  const f = (k: keyof FiscalChile, s: string) => onChange({ ...value, [k]: s });
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4">
        <p className="text-sm font-semibold text-amber-950 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Datos tributarios (Chile · SII)
        </p>
        <p className="mt-2 text-sm text-amber-900/90">
          Información para facturación, boletas y declaraciones. Tus clientes públicos <strong>no</strong> verán el RUT en la página de reserva; solo
          datos de ubicación y comodidades.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">RUT empresa (ej. 76.123.456-K)</label>
          <input value={value.rut_empresa} onChange={(e) => f("rut_empresa", e.target.value)} className="input-field" placeholder="12.345.678-9" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Razón social</label>
          <input value={value.razon_social} onChange={(e) => f("razon_social", e.target.value)} className="input-field" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Nombre de fantasía / marca</label>
          <input value={value.nombre_fantasia} onChange={(e) => f("nombre_fantasia", e.target.value)} className="input-field" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Giro o actividad principal</label>
          <input value={value.giro} onChange={(e) => f("giro", e.target.value)} className="input-field" placeholder="Ej.: Servicios de peluquería" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Dirección casa matriz (tributaria)</label>
          <input value={value.direccion_casa_matriz} onChange={(e) => f("direccion_casa_matriz", e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Comuna</label>
          <input value={value.comuna} onChange={(e) => f("comuna", e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Región</label>
          <input value={value.region} onChange={(e) => f("region", e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Correo tributario / contacto formal</label>
          <input type="email" value={value.email_tributario} onChange={(e) => f("email_tributario", e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Teléfono</label>
          <input value={value.telefono} onChange={(e) => f("telefono", e.target.value)} className="input-field" placeholder="+56 9 …" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Inicio de actividades (opcional)</label>
          <input type="date" value={value.inicio_actividades} onChange={(e) => f("inicio_actividades", e.target.value)} className="input-field max-w-xs" />
        </div>
      </div>
    </div>
  );
}

export function LocationAndHoursStep({
  location,
  horarios,
  onLocation,
  onHorarios,
}: {
  location: LocationPublic;
  horarios: HorariosTienda;
  onLocation: (v: LocationPublic) => void;
  onHorarios: (v: HorariosTienda) => void;
}) {
  const L = (k: keyof LocationPublic, s: string) => onLocation({ ...location, [k]: s });
  const H = (k: keyof HorariosTienda, s: string) => onHorarios({ ...horarios, [k]: s });
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-semibold text-on-surface flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Local donde te atienden los clientes
        </p>
        <p className="mb-3 text-sm text-slate-600">Esta dirección y referencias se muestran en el enlace público de reservas (como en un listado tipo Airbnb).</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Dirección del local</label>
            <input value={location.direccion_atencion} onChange={(e) => L("direccion_atencion", e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Comuna</label>
            <input value={location.comuna} onChange={(e) => L("comuna", e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Región</label>
            <input value={location.region} onChange={(e) => L("region", e.target.value)} className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Cómo llegar / referencias (opcional)</label>
            <textarea
              value={location.referencias_acceso}
              onChange={(e) => L("referencias_acceso", e.target.value)}
              className="input-field min-h-[72px]"
              placeholder="Metro más cercano, estacionamiento, portón, piso…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Enlace a Google Maps (opcional)</label>
            <input value={location.google_maps_url} onChange={(e) => L("google_maps_url", e.target.value)} className="input-field" placeholder="https://maps.google.com/..." />
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 pt-6">
        <p className="mb-3 text-sm font-semibold text-on-surface flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Horarios de atención
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Lunes a viernes</label>
            <input value={horarios.lun_vie} onChange={(e) => H("lun_vie", e.target.value)} className="input-field" placeholder="9:00–18:00" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Sábado</label>
            <input value={horarios.sabado} onChange={(e) => H("sabado", e.target.value)} className="input-field" placeholder="Cerrado o 10:00–14:00" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Domingo y feriados</label>
            <input value={horarios.domingo_feriados} onChange={(e) => H("domingo_feriados", e.target.value)} className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Notas (horarios de verano, citas fuera de horario, etc.)</label>
            <textarea value={horarios.notas} onChange={(e) => H("notas", e.target.value)} className="input-field min-h-[64px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

const EST_OPTS: { id: EstacionamientoTipo; label: string }[] = [
  { id: "no", label: "Sin estacionamiento" },
  { id: "si_gratis", label: "Sí, gratuito" },
  { id: "si_pago", label: "Sí, pago (máquina/cajero)" },
  { id: "limitado", label: "Plazas limitadas / rotación" },
];

const QUICK_LABELS: Record<(typeof AMENITIES_QUICK_KEYS)[number], string> = {
  cafeteria: "Café / bebidas de cortesía",
  wifi: "Wi‑Fi para visitas",
  sala_espera: "Sala de espera",
  acceso_movilidad: "Acceso movilidad reducida",
};

export function AmenitiesStep({ value, onChange }: { value: Amenities; onChange: (v: Amenities) => void }) {
  const [showExtended, setShowExtended] = useState(false);
  const a = (k: keyof Amenities, v: string | boolean) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <p className="text-sm font-semibold text-on-surface flex items-center gap-2">
          <Coffee className="h-4 w-4 text-primary" />
          Comodidades para quien reserva
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Lo más buscado en reservas online y fichas de Google Negocio, Fresha y marketplaces de servicios locales:{" "}
          <strong>20 opciones</strong> (4 rápidas + 16 ampliadas) para que tu ficha pública sea clara como un alojamiento en Airbnb.
        </p>
      </div>
      <div>
        <label className="mb-2 block text-xs font-medium text-slate-600">Estacionamiento</label>
        <div className="flex flex-wrap gap-2">
          {EST_OPTS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => a("estacionamiento", o.id)}
              className={clsx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                value.estacionamiento === o.id ? "border-primary bg-primary/10 text-primary" : "border-slate-200 bg-white text-slate-700"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs text-slate-500">Detalle (plazas aprox., valor, horario del estacionamiento…)</label>
          <input
            value={value.estacionamiento_detalle}
            onChange={(e) => a("estacionamiento_detalle", e.target.value)}
            className="input-field"
            placeholder="Ej.: 6 plazas en el sótano, acceso por calle X"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Comodidades frecuentes</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {AMENITIES_QUICK_KEYS.map((k) => (
            <label key={k} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <input type="checkbox" checked={value[k]} onChange={(e) => a(k, e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              <span className="text-sm text-slate-800">{QUICK_LABELS[k]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
        <button
          type="button"
          onClick={() => setShowExtended((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-on-surface transition hover:bg-primary/5"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            Más comodidades sugeridas (16)
          </span>
          {showExtended ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />}
        </button>
        <p className="px-2 pb-1 text-xs text-slate-600">
          Basadas en lo que suelen destacar negocios de servicios, clínicas, salones y talleres en Chile y plataformas de agendamiento.
        </p>
        {showExtended && (
          <div className="mt-2 grid gap-2 border-t border-primary/10 pt-3 sm:grid-cols-2">
            {AMENITIES_EXTENDED_DEFS.map(({ key, label, hint }) => (
              <label
                key={key}
                className="flex cursor-pointer gap-3 rounded-lg border border-slate-200/90 bg-white p-3 shadow-sm"
              >
                <input
                  type="checkbox"
                  checked={Boolean(value[key])}
                  onChange={(e) => a(key, e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">{label}</span>
                  {hint ? <span className="mt-0.5 block text-xs text-slate-500">{hint}</span> : null}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Otras comodidades (opcional)</label>
        <textarea
          value={value.otras_comodidades}
          onChange={(e) => a("otras_comodidades", e.target.value)}
          className="input-field min-h-[72px]"
          placeholder="Ej.: Cargador USB, revistas, agua filtrada…"
        />
      </div>
    </div>
  );
}
