"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { getStoreId } from "@/lib/store";
import { isAuthenticated } from "@/lib/auth";

interface BottomNavProps {
  onMoreClick: () => void;
}

const MAIN_ITEMS = [
  { href: "/calendar", label: "Agenda", icon: "calendar_today" },
  { href: "/scheduling/panel", label: "Panel", icon: "clinical_notes" },
  { href: "/clients", label: "Clientes", icon: "group" },
  { href: "/products", label: "Inventario", icon: "inventory_2" },
];

const OPERATOR_ITEMS = [
  { href: "/mi-agenda", label: "Mi agenda", icon: "person" },
  { href: "/mi-clientes", label: "Clientes", icon: "groups" },
  { href: "/mi-produccion", label: "Producción", icon: "payments" },
];

export default function BottomNav({ onMoreClick }: BottomNavProps) {
  const pathname = usePathname();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;

  const { data: me } = useQuery({
    queryKey: ["auth-me", storeId],
    queryFn: () => api.get("/auth/me").then((r) => r.data),
    enabled: !!storeId && isAuthenticated(),
    staleTime: 30_000,
  });

  const isOperator = me?.store_context?.member_role === "operator";
  const items = isOperator ? OPERATOR_ITEMS : MAIN_ITEMS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden dark:border-slate-800 dark:bg-slate-900/95">
      {items.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors",
              active
                ? "text-primary"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            <MaterialIcon
              name={icon}
              className={clsx("text-[22px] transition-transform", active && "scale-110")}
              filled={active}
            />
            {label}
          </Link>
        );
      })}

      {/* Botón Más */}
      <button
        type="button"
        onClick={onMoreClick}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
        aria-label="Más opciones"
      >
        <MaterialIcon name="menu" className="text-[22px]" />
        Más
      </button>
    </nav>
  );
}
