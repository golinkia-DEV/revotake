"use client";

import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, CheckCircle, X, Bell, ExternalLink, Menu, Phone, ChevronDown, LogOut, User } from "lucide-react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import api from "@/lib/api";
import Link from "next/link";
import { getStoreId } from "@/lib/store";
import { PhoneQuickBookingForm } from "@/components/scheduling/PhoneQuickBookingForm";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  severity: "error" | "warning" | "info" | "success";
  created_at?: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  error: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300",
  warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300",
  info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300",
  success: "bg-green-50 border-green-200 text-green-800",
};

const SEVERITY_ICON_COLOR: Record<string, string> = {
  error: "text-rose-500",
  warning: "text-amber-500",
  info: "text-blue-500",
  success: "text-emerald-500",
};

function relTime(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `hace ${d}d`;
  if (h > 0) return `hace ${h}h`;
  if (m > 0) return `hace ${m}m`;
  return "ahora";
}

function SeverityIcon({ severity }: { severity: string }) {
  const cls = `h-3.5 w-3.5 shrink-0 ${SEVERITY_ICON_COLOR[severity] ?? "text-slate-400"}`;
  if (severity === "error" || severity === "warning") return <AlertTriangle className={cls} />;
  return <Info className={cls} />;
}

function getInitials(name?: string, email?: string): string {
  const src = name || email || "?";
  const parts = src.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default function TopBar({
  onMenuClick,
}: {
  searchPlaceholder?: string;
  onMenuClick?: () => void;
}) {
  const storeId = getStoreId();
  const [showNotif, setShowNotif] = useState(false);
  const [showPhoneBooking, setShowPhoneBooking] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const notifRef = useRef<HTMLDivElement>(null);
  const phoneBookingRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  const userName: string = me?.name ?? me?.email ?? "";
  const userEmail: string = me?.email ?? "";
  const storeName: string = me?.store_context?.store_name ?? "";

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (phoneBookingRef.current && !phoneBookingRef.current.contains(e.target as Node)) setShowPhoneBooking(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    }
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-100 bg-white/80 px-3 backdrop-blur-md sm:h-16 sm:px-6 dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center gap-2">
        {/* Hamburger */}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600 md:hidden dark:hover:bg-slate-800"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Logo mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <MaterialIcon name="deployed_code" className="text-sm" filled />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">RevoTake</span>
        </div>

        {/* Store name — desktop */}
        {storeName && (
          <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 md:flex dark:border-slate-700 dark:bg-slate-800">
            <MaterialIcon name="storefront" className="text-base text-blue-600" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{storeName}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1.5">
        {/* Phone booking */}
        {storeId && (
          <div ref={phoneBookingRef} className="relative">
            <button
              type="button"
              onClick={() => setShowPhoneBooking((v) => !v)}
              className="flex h-10 items-center gap-1.5 rounded-full px-2.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-blue-600 sm:px-3 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-expanded={showPhoneBooking}
              aria-haspopup="dialog"
              aria-label="Reserva rápida telefónica"
            >
              <Phone className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]" />
              <span className="hidden text-xs font-semibold sm:inline">Reserva rápida</span>
            </button>
            <AnimatePresence>
              {showPhoneBooking && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  className="fixed inset-x-3 top-14 z-50 max-h-[min(85dvh,calc(100dvh-5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:mt-0 sm:w-[min(100vw-24px,28rem)] sm:max-h-[min(80dvh,32rem)] dark:border-slate-700 dark:bg-slate-900"
                  role="dialog"
                  aria-label="Reserva rápida telefónica"
                >
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Reserva telefónica</span>
                    <button
                      type="button"
                      onClick={() => setShowPhoneBooking(false)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                      aria-label="Cerrar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <PhoneQuickBookingForm showHeading={false} onBooked={() => setShowPhoneBooking(false)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Admin panel link */}
        {me?.global_role === "platform_admin" && (
          <Link
            href="/dashboard"
            className="hidden items-center gap-1 rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 sm:inline-flex"
          >
            <MaterialIcon name="dashboard" className="text-base" filled />
            Panel general
          </Link>
        )}

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setShowNotif((v) => !v)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600"
            aria-label="Notificaciones"
          >
            <Bell className="h-5 w-5" />
            {count > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white"
              >
                {count > 9 ? "9+" : count}
              </motion.span>
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
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`mb-1.5 flex items-start gap-2 rounded-xl border p-2.5 text-xs ${SEVERITY_STYLES[n.severity]}`}
                      >
                        <SeverityIcon severity={n.severity} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold leading-tight">{n.title}</p>
                          <p className="mt-0.5 opacity-80">{n.body}</p>
                          <div className="mt-1 flex items-center justify-between">
                            <Link href={n.href} onClick={() => setShowNotif(false)} className="inline-flex items-center gap-1 opacity-70 hover:opacity-100">
                              Ver <ExternalLink className="h-3 w-3" />
                            </Link>
                            {n.created_at && (
                              <span className="text-[10px] opacity-60">{relTime(n.created_at)}</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDismissed((d) => new Set([...d, n.id]))}
                          aria-label="Descartar"
                          className="shrink-0 rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Help */}
        <Link
          href="/settings#ai-context"
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600"
          aria-label="Ayuda"
        >
          <MaterialIcon name="help" className="text-xl" />
        </Link>

        <div className="hidden h-8 w-px bg-slate-200 sm:block dark:bg-slate-700" />

        {/* User avatar + dropdown */}
        <div ref={userMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu((v) => !v)}
            className="hidden items-center gap-2 rounded-full pl-1 pr-2 py-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 sm:flex"
            aria-label="Menú de usuario"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
              {getInitials(userName, userEmail)}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                      {getInitials(userName, userEmail)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{userName || "Usuario"}</p>
                      <p className="truncate text-xs text-slate-500">{userEmail}</p>
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <Link
                    href="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <User className="h-4 w-4" />
                    Mi perfil
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
