"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Users, Kanban, Package, Calendar, Bot, Zap, LogOut, ChevronRight, Building2 } from "lucide-react";
import StoreSwitcher from "./StoreSwitcher";
import { logout } from "@/lib/auth";
import { useRouter } from "next/navigation";
import clsx from "clsx";

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/stores", icon: Building2, label: "Tiendas" },
  { href: "/kanban", icon: Kanban, label: "Tablero Kanban" },
  { href: "/clients", icon: Users, label: "Clientes" },
  { href: "/calendar", icon: Calendar, label: "Agenda" },
  { href: "/products", icon: Package, label: "Productos" },
  { href: "/ai", icon: Bot, label: "Asistente IA" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <aside className="w-64 min-h-screen bg-dark-800/80 backdrop-blur-xl border-r border-white/5 flex flex-col">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-600/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg leading-none">RevoTake</h1>
            <p className="text-xs text-gray-500 mt-0.5">Business Platform</p>
          </div>
        </div>
      </div>
      <div className="px-4 pt-2">
        <StoreSwitcher />
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}>
              <motion.div whileHover={{ x: 2 }} className={clsx("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group", active ? "bg-brand-600/20 text-brand-400 border border-brand-500/20" : "text-gray-400 hover:text-white hover:bg-white/5")}>
                <Icon className={clsx("w-5 h-5 transition-colors", active ? "text-brand-400" : "text-gray-500 group-hover:text-white")} />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto text-brand-500" />}
              </motion.div>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/5">
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 w-full">
          <LogOut className="w-5 h-5" />
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}
