"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, ChevronRight } from "lucide-react";
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

const FULL_NAV: NavItem[] = [
  { href: "/calendar", label: "Agenda", icon: "calendar_today", filled: true },
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/stores", label: "Tiendas", icon: "storefront" },
  { href: "/kanban", label: "Operaciones", icon: "settings_suggest", filled: true },
  { href: "/clients", label: "Clientes", icon: "group" },
  { href: "/scheduling", label: "Citas", icon: "event_available", filled: true },
  { href: "/scheduling/services", label: "Menú de servicios", icon: "menu_book", filled: true },
  { href: "/scheduling/profesionales", label: "Crear profesional", icon: "person_add", filled: true },
  { href: "/scheduling/sedes", label: "Sedes y equipo", icon: "location_city", filled: true },
  { href: "/scheduling/panel", label: "Panel atención", icon: "clinical_notes", filled: true },
  { href: "/equipo", label: "Equipo y permisos", icon: "admin_panel_settings", filled: true },
  { href: "/mi-agenda", label: "Mi agenda", icon: "person", filled: true },
  { href: "/products", label: "Inventario", icon: "inventory_2" },
  { href: "/ai", label: "Asistente IA", icon: "psychology", filled: true },
  { href: "/settings", label: "Configuración", icon: "settings" },
];

/** Menú reducido para rol operador (profesional): según permisos que deje el gerente. */
const OPERATOR_NAV: NavItem[] = [
  { href: "/stores", label: "Tiendas", icon: "storefront", perm: null },
  { href: "/mi-agenda", label: "Mi agenda", icon: "person", filled: true, perm: "ver_agenda_propia" },
  { href: "/mi-clientes", label: "Mis clientes", icon: "groups", perm: "ver_clientes_propios" },
  { href: "/mi-produccion", label: "Mi producción", icon: "payments", filled: true, perm: "ver_reportes_comisiones" },
];

export default function Sidebar() {
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

  const nav: NavItem[] = isOperator
    ? OPERATOR_NAV.filter((it) => it.perm == null || perms.has(it.perm))
    : FULL_NAV.filter(
        (it) => it.href !== "/equipo" || me?.store_context?.member_role === "admin"
      );

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-slate-50 p-4 font-medium antialiased dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
          <MaterialIcon name="deployed_code" className="text-xl" filled />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">RevoTake</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Belleza & bienestar</p>
        </div>
      </div>
      <div className="px-1 pb-2">
        <StoreSwitcher />
      </div>
      {isOperator && (
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Vista profesional</p>
      )}
      <nav className="flex-1 space-y-1">
        {nav.map(({ href, icon, label, filled, perm: _p }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors",
                  active
                    ? "bg-blue-50 font-semibold text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                )}
              >
                <MaterialIcon name={icon} className="text-xl" filled={active || filled} />
                {label}
                {active && <ChevronRight className="ml-auto h-3 w-3 text-primary" />}
              </motion.div>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-1 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <LogOut className="h-5 w-5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
