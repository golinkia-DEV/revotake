"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { getStoreId } from "@/lib/store";
import { isAuthenticated } from "@/lib/auth";
import { buildBottomItems } from "@/lib/navigation";

interface BottomNavProps {
  onMoreClick: () => void;
}

export default function BottomNav({ onMoreClick }: BottomNavProps) {
  const pathname = usePathname();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;

  const { data: me } = useQuery({
    queryKey: ["auth-me", storeId],
    queryFn: () => api.get("/auth/me").then((r) => r.data),
    enabled: !!storeId && isAuthenticated(),
    staleTime: 30_000,
  });

  const items = buildBottomItems(me);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden dark:border-slate-800 dark:bg-slate-900/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-16 w-full items-stretch">
        {items.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-slate-400 active:text-slate-600 dark:active:text-slate-200"
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
              )}
              <div
                className={clsx(
                  "flex h-8 w-14 items-center justify-center rounded-full transition-all",
                  active ? "bg-primary/10" : ""
                )}
              >
                <MaterialIcon
                  name={icon}
                  className="text-[22px]"
                  filled={active}
                />
              </div>
              <span className={clsx("leading-none", active && "font-semibold")}>{label}</span>
            </Link>
          );
        })}

        {/* Botón Más */}
        <button
          type="button"
          onClick={onMoreClick}
          className="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-400 transition-colors active:text-slate-600 dark:active:text-slate-200"
          aria-label="Más opciones"
        >
          <div className="flex h-8 w-14 items-center justify-center rounded-full">
            <MaterialIcon name="menu" className="text-[22px]" />
          </div>
          <span className="leading-none">Más</span>
        </button>
      </div>
    </nav>
  );
}
