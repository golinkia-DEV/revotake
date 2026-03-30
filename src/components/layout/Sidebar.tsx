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

const nav: { href: string; label: string; icon: string; filled?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/stores", label: "Tiendas", icon: "storefront" },
  { href: "/kanban", label: "Operaciones", icon: "settings_suggest", filled: true },
  { href: "/clients", label: "Clientes", icon: "group" },
  { href: "/calendar", label: "Agenda", icon: "calendar_today" },
  { href: "/scheduling", label: "Citas", icon: "event_available", filled: true },
  { href: "/scheduling/services", label: "Menú de servicios", icon: "menu_book", filled: true },
  { href: "/scheduling/panel", label: "Panel atención", icon: "clinical_notes", filled: true },
  { href: "/mi-agenda", label: "Mi agenda", icon: "person", filled: true },
  { href: "/products", label: "Inventario", icon: "inventory_2" },
  { href: "/ai", label: "Asistente IA", icon: "psychology", filled: true },
  { href: "/settings", label: "Configuración", icon: "settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

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
      <nav className="flex-1 space-y-1">
        {nav.map(({ href, icon, label, filled }) => {
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
