"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, ChevronRight, X } from "lucide-react";
import StoreSwitcher from "./StoreSwitcher";
import { logout } from "@/lib/auth";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { getStoreId } from "@/lib/store";
import { isAuthenticated } from "@/lib/auth";

type NavItem = { href: string; label: string; icon: string; filled?: boolean; perm?: string | null };
type NavSection = { title: string; items: NavItem[] };

const FULL_NAV_SECTIONS: NavSection[] = [
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
      { href: "/clients", label: "Clientes", icon: "group" },
      { href: "/scheduling", label: "Citas", icon: "event_available", filled: true },
      { href: "/scheduling/services", label: "Crear servicios", icon: "menu_book", filled: true },
    ],
  },
  {
    title: "Equipo",
    items: [
      { href: "/scheduling/profesionales", label: "Profesionales", icon: "person_add", filled: true },
      { href: "/scheduling/sedes", label: "Sedes", icon: "location_city", filled: true },
      { href: "/equipo", label: "Equipo y permisos", icon: "admin_panel_settings", filled: true },
      { href: "/mi-agenda", label: "Mi agenda", icon: "person", filled: true },
    ],
  },
  {
    title: "Gestión",
    items: [
      { href: "/products", label: "Productos a la venta", icon: "inventory_2" },
      { href: "/stores", label: "Tiendas", icon: "storefront" },
      { href: "/settings/payments", label: "Métodos de pago", icon: "payments", filled: true },
      { href: "/ai", label: "Asistente IA", icon: "psychology", filled: true },
      { href: "/settings", label: "Configuración", icon: "settings" },
    ],
  },
];

const OPERATOR_NAV: NavItem[] = [
  { href: "/stores", label: "Tiendas", icon: "storefront", perm: null },
  { href: "/mi-agenda", label: "Mi agenda", icon: "person", filled: true, perm: "ver_agenda_propia" },
  { href: "/mi-clientes", label: "Mis clientes", icon: "groups", perm: "ver_clientes_propios" },
  { href: "/mi-produccion", label: "Mi producción", icon: "payments", filled: true, perm: "ver_reportes_comisiones" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;

  const { data: me } = useQuery({
    queryKey: ["auth-me", storeId],
    queryFn: () => api.get("/auth/me").then((r) => r.data),
    enabled: !!storeId && isAuthenticated(),
    staleTime: 30_000,
  });

  const isOperator = me?.store_context?.member_role === "operator";
  const perms = new Set<string>((me?.store_context?.permissions as string[] | undefined) ?? []);

  const operatorNav = OPERATOR_NAV.filter((it) => it.perm == null || perms.has(it.perm));

  // Para admin filtramos equipo solo si es admin
  const fullNavSections = FULL_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (it) => it.href !== "/equipo" || me?.store_context?.member_role === "admin"
    ),
  })).filter((s) => s.items.length > 0);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  function handleNavClick() {
    onClose();
  }

  function NavLink({ href, icon, label, filled }: NavItem) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href} onClick={handleNavClick}>
        <motion.div
          whileHover={{ x: 2 }}
          className={clsx(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
            active
              ? "bg-primary/10 font-semibold text-primary dark:bg-primary/20 dark:text-primary"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          )}
        >
          <MaterialIcon name={icon} className="text-xl shrink-0" filled={active || filled} />
          <span className="flex-1 truncate">{label}</span>
          {active && <ChevronRight className="h-3 w-3 shrink-0 text-primary" />}
        </motion.div>
      </Link>
    );
  }

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          "fixed left-0 top-0 z-50 flex h-[100dvh] w-64 flex-col border-r border-slate-200 bg-white font-medium antialiased transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/25">
              <MaterialIcon name="deployed_code" className="text-lg" filled />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">RevoTake</h1>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Belleza & bienestar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:hidden dark:hover:bg-slate-800"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Store switcher */}
        <div className="px-3 pb-3">
          <StoreSwitcher />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {isOperator ? (
            <>
              <p className="mb-1 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Vista profesional</p>
              <div className="space-y-0.5">
                {operatorNav.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            </>
          ) : (
            fullNavSections.map((section) => (
              <div key={section.title} className="mb-3">
                <p className="mb-1 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavLink key={item.href} {...item} />
                  ))}
                </div>
              </div>
            ))
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-100 px-2 py-2 dark:border-slate-800">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
