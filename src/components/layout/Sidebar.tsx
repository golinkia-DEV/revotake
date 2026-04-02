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
import { buildNavSections, type NavItem } from "@/lib/navigation";

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

  const navSections = buildNavSections(me);

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
          whileHover={{ x: 3 }}
          transition={{ duration: 0.1 }}
          className={clsx(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
            active
              ? "bg-violet-500/15 font-semibold text-violet-300"
              : "text-[#A1A1C2] hover:bg-white/5 hover:text-slate-200"
          )}
        >
          <MaterialIcon name={icon} className="text-xl shrink-0" filled={active || filled} />
          <span className="flex-1 truncate">{label}</span>
          {active && <ChevronRight className="h-3 w-3 shrink-0 text-violet-400" />}
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
          "fixed left-0 top-0 z-50 flex h-[100dvh] w-64 flex-col border-r border-white/5 bg-[#1E1B2E] font-medium antialiased transition-transform duration-300",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-rose-500 text-white shadow-lg shadow-violet-500/30">
              <MaterialIcon name="deployed_code" className="text-lg" filled />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">RevoTake</h1>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Belleza & bienestar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/10 hover:text-slate-300 md:hidden"
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
          {navSections.map((section) => (
            <div key={section.title} className="mb-3">
              <p className="mb-1 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/5 px-2 py-2">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
