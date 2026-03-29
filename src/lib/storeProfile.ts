/**
 * Perfil de tienda: datos tributarios (Chile), ubicación para clientes, horarios y comodidades.
 * Se guarda en Store.settings.store_profile (JSON).
 */

export interface FiscalChile {
  rut_empresa: string;
  razon_social: string;
  nombre_fantasia: string;
  giro: string;
  direccion_casa_matriz: string;
  comuna: string;
  region: string;
  email_tributario: string;
  telefono: string;
  /** YYYY-MM-DD si aplica */
  inicio_actividades: string;
}

export interface LocationPublic {
  direccion_atencion: string;
  comuna: string;
  region: string;
  referencias_acceso: string;
  google_maps_url: string;
}

export interface HorariosTienda {
  lun_vie: string;
  sabado: string;
  domingo_feriados: string;
  notas: string;
}

export type EstacionamientoTipo = "no" | "si_gratis" | "si_pago" | "limitado";

export interface Amenities {
  estacionamiento: EstacionamientoTipo;
  estacionamiento_detalle: string;
  cafeteria: boolean;
  wifi: boolean;
  sala_espera: boolean;
  acceso_movilidad: boolean;
  /** Comodidades extra (benchmark: Google Negocio, Fresha, Treatwell, reservas locales CL) */
  aire_acondicionado: boolean;
  banos_accesibles: boolean;
  mascotas_bienvenidas: boolean;
  cargadores_usb: boolean;
  entretenimiento_espera: boolean;
  pago_tarjeta: boolean;
  pago_digital: boolean;
  factura_electronica: boolean;
  turno_pantalla: boolean;
  retiro_en_tienda: boolean;
  zona_infantil: boolean;
  atencion_idiomas: boolean;
  higiene_visible: boolean;
  bicicletero: boolean;
  agua_gratis: boolean;
  terraza_exterior: boolean;
  otras_comodidades: string;
}

/** Las 4 comodidades visibles por defecto en el paso del asistente */
export const AMENITIES_QUICK_KEYS = ["cafeteria", "wifi", "sala_espera", "acceso_movilidad"] as const;

/** 16 opciones adicionales detrás de “Más comodidades” (20 en total con las anteriores) */
export const AMENITIES_EXTENDED_DEFS: { key: keyof Amenities; label: string; hint?: string }[] = [
  { key: "aire_acondicionado", label: "Climatización / aire acondicionado", hint: "Confort frecuente en clínicas y salones premium" },
  { key: "banos_accesibles", label: "Baños accesibles", hint: "Más allá del acceso a local" },
  { key: "mascotas_bienvenidas", label: "Mascotas bienvenidas (zona común)", hint: "Tendencia en retail y servicios de barrio" },
  { key: "cargadores_usb", label: "Enchufes o carga USB en espera", hint: "Similar a coworking / clínicas digitales" },
  { key: "entretenimiento_espera", label: "TV, música o revistas en espera", hint: "Reduce percepción de espera" },
  { key: "pago_tarjeta", label: "Pago con tarjeta (débito o crédito)", hint: "Expectativa estándar en Chile" },
  { key: "pago_digital", label: "Transferencia, QR o billetera digital", hint: "MACH, Mercado Pago, transferencia" },
  { key: "factura_electronica", label: "Boleta o factura electrónica", hint: "Importante para B2B y empresas" },
  { key: "turno_pantalla", label: "Turno por orden de llegada o pantalla", hint: "Salud, bancos, retail con fila" },
  { key: "retiro_en_tienda", label: "Retiro en tienda / punto de entrega", hint: "Click & collect, talleres" },
  { key: "zona_infantil", label: "Zona infantil o juegos", hint: "Familias en clínicas, peluquería" },
  { key: "atencion_idiomas", label: "Atención en inglés u otro idioma", hint: "Turismo y barrios premium" },
  { key: "higiene_visible", label: "Protocolos de higiene señalizados", hint: "Confianza post-pandemia" },
  { key: "bicicletero", label: "Estacionamiento para bicicletas", hint: "Movilidad urbana" },
  { key: "agua_gratis", label: "Agua filtrada o bebida fría de cortesía", hint: "Detalle tipo hospitalidad" },
  { key: "terraza_exterior", label: "Terraza o espera al aire libre", hint: "Bienestar, cafés, centros estéticos" },
];

const AMENITIES_QUICK_LABELS: Record<(typeof AMENITIES_QUICK_KEYS)[number], string> = {
  cafeteria: "Café / bebidas de cortesía",
  wifi: "Wi‑Fi para visitas",
  sala_espera: "Sala de espera",
  acceso_movilidad: "Acceso movilidad reducida",
};

/** Etiquetas legibles de todas las comodidades booleanas activas (orden: rápidas + extendidas). */
export function listSelectedAmenityLabels(value: Amenities): string[] {
  const labels: string[] = [];
  for (const k of AMENITIES_QUICK_KEYS) {
    if (value[k]) labels.push(AMENITIES_QUICK_LABELS[k]);
  }
  for (const { key, label } of AMENITIES_EXTENDED_DEFS) {
    if (value[key]) labels.push(label);
  }
  return labels;
}

export interface StoreProfile {
  fiscal_chile: FiscalChile;
  location_public: LocationPublic;
  horarios: HorariosTienda;
  amenities: Amenities;
  profile_version: number;
}

export const emptyFiscalChile = (): FiscalChile => ({
  rut_empresa: "",
  razon_social: "",
  nombre_fantasia: "",
  giro: "",
  direccion_casa_matriz: "",
  comuna: "",
  region: "",
  email_tributario: "",
  telefono: "",
  inicio_actividades: "",
});

export const emptyLocationPublic = (): LocationPublic => ({
  direccion_atencion: "",
  comuna: "",
  region: "",
  referencias_acceso: "",
  google_maps_url: "",
});

export const emptyHorarios = (): HorariosTienda => ({
  lun_vie: "Lunes a viernes 9:00–18:00",
  sabado: "",
  domingo_feriados: "Cerrado",
  notas: "",
});

export const emptyAmenities = (): Amenities => ({
  estacionamiento: "no",
  estacionamiento_detalle: "",
  cafeteria: false,
  wifi: false,
  sala_espera: false,
  acceso_movilidad: false,
  aire_acondicionado: false,
  banos_accesibles: false,
  mascotas_bienvenidas: false,
  cargadores_usb: false,
  entretenimiento_espera: false,
  pago_tarjeta: false,
  pago_digital: false,
  factura_electronica: false,
  turno_pantalla: false,
  retiro_en_tienda: false,
  zona_infantil: false,
  atencion_idiomas: false,
  higiene_visible: false,
  bicicletero: false,
  agua_gratis: false,
  terraza_exterior: false,
  otras_comodidades: "",
});

export const emptyStoreProfile = (): StoreProfile => ({
  fiscal_chile: emptyFiscalChile(),
  location_public: emptyLocationPublic(),
  horarios: emptyHorarios(),
  amenities: emptyAmenities(),
  profile_version: 1,
});

/** Para la API pública: sin datos tributarios. */
export function publicSliceFromStoreProfile(profile: StoreProfile | null | undefined) {
  if (!profile) return null;
  return {
    location_public: profile.location_public,
    horarios: profile.horarios,
    amenities: profile.amenities,
  };
}

export function mergeStoreProfileFromApi(raw: unknown): StoreProfile {
  const e = emptyStoreProfile();
  if (!raw || typeof raw !== "object") return e;
  const r = raw as Record<string, unknown>;
  const fc = (r.fiscal_chile as Record<string, string>) || {};
  const lp = (r.location_public as Record<string, string>) || {};
  const ho = (r.horarios as Record<string, string>) || {};
  const am = (r.amenities as Record<string, unknown>) || {};
  return {
    profile_version: typeof r.profile_version === "number" ? r.profile_version : 1,
    fiscal_chile: { ...e.fiscal_chile, ...fc },
    location_public: { ...e.location_public, ...lp },
    horarios: { ...e.horarios, ...ho },
    amenities: {
      ...e.amenities,
      estacionamiento: (am.estacionamiento as Amenities["estacionamiento"]) || e.amenities.estacionamiento,
      estacionamiento_detalle: String(am.estacionamiento_detalle ?? ""),
      cafeteria: Boolean(am.cafeteria),
      wifi: Boolean(am.wifi),
      sala_espera: Boolean(am.sala_espera),
      acceso_movilidad: Boolean(am.acceso_movilidad),
      aire_acondicionado: Boolean(am.aire_acondicionado),
      banos_accesibles: Boolean(am.banos_accesibles),
      mascotas_bienvenidas: Boolean(am.mascotas_bienvenidas),
      cargadores_usb: Boolean(am.cargadores_usb),
      entretenimiento_espera: Boolean(am.entretenimiento_espera),
      pago_tarjeta: Boolean(am.pago_tarjeta),
      pago_digital: Boolean(am.pago_digital),
      factura_electronica: Boolean(am.factura_electronica),
      turno_pantalla: Boolean(am.turno_pantalla),
      retiro_en_tienda: Boolean(am.retiro_en_tienda),
      zona_infantil: Boolean(am.zona_infantil),
      atencion_idiomas: Boolean(am.atencion_idiomas),
      higiene_visible: Boolean(am.higiene_visible),
      bicicletero: Boolean(am.bicicletero),
      agua_gratis: Boolean(am.agua_gratis),
      terraza_exterior: Boolean(am.terraza_exterior),
      otras_comodidades: String(am.otras_comodidades ?? ""),
    },
  };
}
