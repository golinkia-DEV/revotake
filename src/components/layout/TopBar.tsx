"use client";

import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, CheckCircle, X, Bell, ExternalLink } from "lucide-react";
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
  if (severity === "error") return <AlertTriangle className="h-3.5 w-3.5 shrink-0" />;
  if (severity === "warning") return <AlertTriangle className="h-3.5 w-3.5 shrink-0" />;
  return <Info className="h-3.5 w-3.5 shrink-0" />;
}

export default function TopBar({ searchPlaceholder = "Buscar operaciones, clientes o inventario..." }: { searchPlaceholder?: string }) {
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

  const allItems: NotificationItem[] = notifData?.items ?? [];
  const visible = allItems.filter((n) => !dismissed.has(n.id));
  const count = visible.length;

  // Cerrar al click fuera
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
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-100 bg-white/80 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
      <div className="relative flex max-w-md flex-1 items-center">
        <MaterialIcon name="search" className="pointer-events-none absolute left-3 text-lg text-slate-400" />
        <input
          type="search"
          className="w-full rounded-full border-none bg-surface-container-low py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20"
          placeholder={searchPlaceholder}
          aria-label="Buscar"
        />
      </div>

      <div className="ml-4 flex items-center gap-2 sm:gap-4">
        {/* Notificaciones */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setShowNotif((v) => !v)}
            className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary"
            aria-label="Notificaciones"
          >
            <Bell className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
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
                className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
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
                <div className="max-h-80 overflow-y-auto p-2">
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
                        <div className="flex-1 min-w-0">
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

        {/* Ayuda */}
        <Link
          href="/settings#ai-context"
          className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary"
          aria-label="Configuración IA"
          title="Configuración IA / Ayuda"
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
