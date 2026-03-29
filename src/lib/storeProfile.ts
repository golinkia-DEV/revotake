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
  otras_comodidades: string;
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
      otras_comodidades: String(am.otras_comodidades ?? ""),
    },
  };
}
