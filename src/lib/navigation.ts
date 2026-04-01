"use client";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  filled?: boolean;
  perm?: string;
};

export type NavSection = { title: string; items: NavItem[] };

type AuthMe = {
  global_role?: string;
  platform_permissions?: string[];
  store_context?: {
    member_role?: string;
    member_role_normalized?: string;
    permissions?: string[];
  } | null;
};

const PLATFORM_ADMIN_SECTIONS: NavSection[] = [
  {
    title: "Plataforma",
    items: [
      { href: "/dashboard", label: "Dashboard global", icon: "dashboard" },
      { href: "/stores", label: "Tiendas", icon: "storefront", perm: "platform_manage_stores" },
      { href: "/settings/payments", label: "Pagos globales", icon: "payments", perm: "platform_manage_global_payments" },
    ],
  },
];

const PLATFORM_OPERATOR_SECTIONS: NavSection[] = [
  {
    title: "Contabilidad",
    items: [
      { href: "/dashboard", label: "Ingresos y egresos", icon: "payments", perm: "platform_view_finance" },
    ],
  },
];

const STORE_ADMIN_SECTIONS: NavSection[] = [
  {
    title: "Principal",
    items: [
      { href: "/calendar", label: "Agenda", icon: "calendar_today", filled: true },
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/kanban", label: "Operaciones", icon: "settings_suggest", filled: true },
      { href: "/scheduling/panel", label: "Panel atención", icon: "clinical_notes", filled: true },
    ],
  },
  {
    title: "Clientes y citas",
    items: [
      { href: "/clients", label: "Clientes", icon: "group", perm: "ver_base_clientes" },
      { href: "/scheduling", label: "Citas", icon: "event_available", filled: true, perm: "ver_agenda_tienda" },
      { href: "/scheduling/flash-deals", label: "Ofertas Flash", icon: "bolt", filled: true, perm: "ver_agenda_tienda" },
      { href: "/scheduling/services", label: "Crear servicios", icon: "menu_book", filled: true, perm: "ver_catalogo_agenda" },
    ],
  },
  {
    title: "Equipo",
    items: [
      { href: "/scheduling/profesionales", label: "Profesionales", icon: "person_add", filled: true, perm: "ver_catalogo_agenda" },
      { href: "/scheduling/sedes", label: "Sedes", icon: "location_city", filled: true, perm: "ver_catalogo_agenda" },
      { href: "/equipo", label: "Equipo y permisos", icon: "admin_panel_settings", filled: true },
    ],
  },
  {
    title: "Gestión",
    items: [
      { href: "/products", label: "Productos a la venta", icon: "inventory_2", perm: "registrar_ventas" },
      { href: "/proveedores", label: "Proveedores", icon: "local_shipping", perm: "registrar_ventas" },
      { href: "/settings/payments", label: "Métodos de pago", icon: "payments", filled: true, perm: "ver_reportes_pagos" },
      { href: "/ai", label: "Asistente IA", icon: "psychology", filled: true },
      { href: "/settings", label: "Configuración", icon: "settings" },
    ],
  },
];

const BRANCH_ADMIN_SECTIONS: NavSection[] = STORE_ADMIN_SECTIONS.map((section) => ({
  ...section,
  items: section.items.filter((item) => item.href !== "/equipo"),
}));

const WORKER_SECTIONS: NavSection[] = [
  {
    title: "Vista trabajador",
    items: [
      { href: "/stores", label: "Tiendas", icon: "storefront" },
      { href: "/mi-agenda", label: "Mi agenda", icon: "person", filled: true, perm: "ver_agenda_propia" },
      { href: "/mi-clientes", label: "Mis clientes", icon: "groups", perm: "ver_clientes_propios" },
      { href: "/mi-produccion", label: "Mi producción", icon: "payments", filled: true, perm: "ver_reportes_comisiones" },
    ],
  },
];

const BRANCH_OPERATOR_SECTIONS: NavSection[] = [
  {
    title: "Sucursal",
    items: [
      { href: "/dashboard", label: "Ingresos y egresos", icon: "payments", perm: "ver_reportes" },
      { href: "/mi-produccion", label: "Producción", icon: "query_stats", perm: "ver_reportes_comisiones" },
    ],
  },
];

function normalizeMemberRole(me?: AuthMe | null): string {
  const fromNormalized = me?.store_context?.member_role_normalized;
  if (fromNormalized) return fromNormalized;
  const raw = me?.store_context?.member_role;
  if (raw === "admin") return "store_admin";
  if (raw === "seller") return "branch_admin";
  if (raw === "operator") return "worker";
  return raw || "";
}

function selectSections(me?: AuthMe | null): NavSection[] {
  const globalRole = me?.global_role;
  const memberRole = normalizeMemberRole(me);
  // Si existe contexto de tienda, priorizamos el rol de tienda/sucursal para
  // asegurar acceso completo al menú operativo de esa tienda.
  if (memberRole === "store_admin") return STORE_ADMIN_SECTIONS;
  if (memberRole === "branch_admin") return BRANCH_ADMIN_SECTIONS;
  if (memberRole === "branch_operator") return BRANCH_OPERATOR_SECTIONS;
  if (memberRole === "worker") return WORKER_SECTIONS;

  // Sin contexto de tienda: usamos navegación de plataforma.
  if (globalRole === "platform_admin") return PLATFORM_ADMIN_SECTIONS;
  if (globalRole === "platform_operator") return PLATFORM_OPERATOR_SECTIONS;
  return WORKER_SECTIONS;
}

export function buildNavSections(me?: AuthMe | null): NavSection[] {
  const storePerms = new Set<string>(me?.store_context?.permissions ?? []);
  const platformPerms = new Set<string>(me?.platform_permissions ?? []);
  return selectSections(me)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.perm) return true;
        return storePerms.has(item.perm) || platformPerms.has(item.perm);
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export function buildBottomItems(me?: AuthMe | null): NavItem[] {
  const sections = buildNavSections(me);
  const flat = sections.flatMap((s) => s.items);
  if (!flat.length) return [{ href: "/stores", label: "Tiendas", icon: "storefront" }];
  return flat.slice(0, 4);
}

export function canAccessPath(pathname: string, me?: AuthMe | null): boolean {
  const sections = buildNavSections(me);
  const allowed = new Set<string>(sections.flatMap((s) => s.items.map((i) => i.href)));
  if (pathname.startsWith("/stores") || pathname.startsWith("/profesional")) return true;
  if (pathname === "/login") return true;
  for (const href of allowed) {
    if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  }
  return false;
}

