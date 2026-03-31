"use client";

import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, CheckCircle, X, Bell, ExternalLink, Menu } from "lucide-react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import api from "@/lib/api";
import Link from "next/link";
import { getStoreId } from "@/lib/store";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  severity: "error" | "warning" | "info" | "success";
}

const SEVERITY_STYLES: Record<string, string> = {
  error: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300",
  warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300",
  info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300",
  success: "bg-green-50 border-green-200 text-green-800",
};

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "error" || severity === "warning") return <AlertTriangle className="h-3.5 w-3.5 shrink-0" />;
  return <Info className="h-3.5 w-3.5 shrink-0" />;
}

export default function TopBar({
  searchPlaceholder = "Buscar…",
  onMenuClick,
}: {
  searchPlaceholder?: string;
  onMenuClick?: () => void;
}) {
  const storeId = getStoreId();
  const [showNotif, setShowNotif] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: notifData } = useQuery({
    queryKey: ["notifications", storeId],
    queryFn: () => api.get("/notifications/").then((r) => r.data),
    enabled: !!storeId,
    refetchInterval: 60_000,
  });
  const { data: me } = useQuery({
    queryKey: ["auth-me-topbar", storeId],
    queryFn: () => api.get("/auth/me").then((r) => r.data),
    enabled: !!storeId,
    staleTime: 30_000,
  });

  const allItems: NotificationItem[] = notifData?.items ?? [];
  const visible = allItems.filter((n) => !dismissed.has(n.id));
  const count = visible.length;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-100 bg-white/80 px-3 backdrop-blur-md sm:h-16 sm:px-6 dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center gap-2">
        {/* Hamburger — visible en mobile y tablet, oculto en desktop donde el sidebar es fijo */}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-primary md:hidden dark:hover:bg-slate-800"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Logo en mobile — solo visible cuando el sidebar está oculto */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white shadow-sm shadow-primary/20">
            <MaterialIcon name="deployed_code" className="text-sm" filled />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">RevoTake</span>
        </div>

        {/* Search — visible desde sm en desktop */}
        <div className="relative hidden w-full max-w-xs items-center sm:flex md:max-w-md">
          <MaterialIcon name="search" className="pointer-events-none absolute left-3 text-lg text-slate-400" />
          <input
            type="search"
            className="w-full rounded-full border-none bg-surface-container-low py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20"
            placeholder={searchPlaceholder}
            aria-label="Buscar"
          />
        </div>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-2">
        {me?.global_role === "platform_admin" && (
          <Link
            href="/dashboard"
            className="hidden items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90 sm:inline-flex"
          >
            <MaterialIcon name="dashboard" className="text-base" filled />
            Panel general
          </Link>
        )}
        {/* Search icon en mobile */}
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 sm:hidden"
          aria-label="Buscar"
        >
          <MaterialIcon name="search" className="text-xl" />
        </button>

        {/* Notificaciones */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setShowNotif((v) => !v)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary"
            aria-label="Notificaciones"
          >
            <Bell className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotif && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                className="absolute right-0 top-12 z-50 w-[calc(100vw-24px)] max-w-xs rounded-2xl border border-slate-200 bg-white shadow-xl sm:w-80 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notificaciones</span>
                  {count > 0 && (
                    <button
                      type="button"
                      onClick={() => setDismissed(new Set(allItems.map((n) => n.id)))}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Marcar todas leídas
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto p-2 sm:max-h-80">
                  {visible.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                      <CheckCircle className="h-8 w-8" />
                      <p className="text-sm">Todo en orden</p>
                    </div>
                  ) : (
                    visible.map((n) => (
                      <div
                        key={n.id}
                        className={`mb-1.5 flex items-start gap-2 rounded-xl border p-2.5 text-xs ${SEVERITY_STYLES[n.severity]}`}
                      >
                        <SeverityIcon severity={n.severity} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold leading-tight">{n.title}</p>
                          <p className="mt-0.5 opacity-80">{n.body}</p>
                          <Link href={n.href} onClick={() => setShowNotif(false)} className="mt-1 inline-flex items-center gap-1 opacity-70 hover:opacity-100">
                            Ver <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                        <button type="button" onClick={() => setDismissed((d) => new Set([...d, n.id]))}>
                          <X className="h-3.5 w-3.5 shrink-0 opacity-50 hover:opacity-100" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Configuración IA */}
        <Link
          href="/settings#ai-context"
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary"
          aria-label="Configuración"
        >
          <MaterialIcon name="help" className="text-xl" />
        </Link>

        <div className="hidden h-8 w-px bg-slate-200 sm:block" />
        <div className="hidden items-center gap-2 pl-1 sm:flex">
          <span className="text-sm font-semibold text-on-surface">RevoTake</span>
          <div className="h-9 w-9 rounded-full border-2 border-primary/10 bg-primary-fixed/40 ring-2 ring-primary/5" />
        </div>
      </div>
    </header>
  );
}
