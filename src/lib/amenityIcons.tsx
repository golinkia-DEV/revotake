import type { LucideIcon } from "lucide-react";
import {
  Accessibility,
  AirVent,
  Armchair,
  Baby,
  Ban,
  Bath,
  Bike,
  Car,
  CircleDollarSign,
  Coffee,
  CreditCard,
  Dog,
  Droplets,
  GlassWater,
  Languages,
  Monitor,
  Package,
  Plug,
  QrCode,
  Receipt,
  Shuffle,
  SprayCan,
  Sun,
  Tv,
  Wifi,
} from "lucide-react";
import type { AmenityToggleKey, EstacionamientoTipo } from "./storeProfile";

/** Icono por tipo de estacionamiento (botones del paso de comodidades). */
export const PARKING_OPTION_ICONS: Record<EstacionamientoTipo, LucideIcon> = {
  no: Ban,
  si_gratis: Car,
  si_pago: CircleDollarSign,
  limitado: Shuffle,
};

/** Icono por cada comodidad booleana (20 ítems + coherencia en ficha pública). */
export const AMENITY_ICONS: Record<AmenityToggleKey, LucideIcon> = {
  cafeteria: Coffee,
  wifi: Wifi,
  sala_espera: Armchair,
  acceso_movilidad: Accessibility,
  aire_acondicionado: AirVent,
  banos_accesibles: Bath,
  mascotas_bienvenidas: Dog,
  cargadores_usb: Plug,
  entretenimiento_espera: Tv,
  pago_tarjeta: CreditCard,
  pago_digital: QrCode,
  factura_electronica: Receipt,
  turno_pantalla: Monitor,
  retiro_en_tienda: Package,
  zona_infantil: Baby,
  atencion_idiomas: Languages,
  higiene_visible: SprayCan,
  bicicletero: Bike,
  agua_gratis: GlassWater,
  terraza_exterior: Sun,
};
