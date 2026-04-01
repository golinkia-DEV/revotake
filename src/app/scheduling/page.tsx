"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Calendar, ExternalLink, BarChart3, ClipboardList, Download,
  Star, TrendingUp, XCircle, Users, DollarSign, Activity,
} from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { getStoreId } from "@/lib/store";
import Link from "next/link";
import PageSectionMenu from "@/components/ui/PageSectionMenu";

function Badge({ children, variant }: { children: React.ReactNode; variant: "emerald" | "amber" | "rose" | "blue" | "slate" | "purple" }) {
  const cls = {
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  }[variant];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "emerald" | "amber" | "rose" | "blue" | "slate" | "purple" }> = {
  pending: { label: "Pendiente", variant: "slate" },
  confirmed: { label: "Confirmada", variant: "emerald" },
  cancelled: { label: "Cancelada", variant: "rose" },
  completed: { label: "Completada", variant: "blue" },
  no_show: { label: "No-show", variant: "slate" },
  pending_payment: { label: "Pago pendiente", variant: "amber" },
};

function fmtCLP(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400">
      {"★".repeat(Math.round(rating))}
      <span className="text-slate-300">{"★".repeat(5 - Math.round(rating))}</span>
    </span>
  );
}

export default function SchedulingAdminPage() {
  const [activeSection, setActiveSection] = useState<"resumen" | "calificaciones" | "citas" | "recursos">("resumen");
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: () => api.get("/stores/").then((r) => r.data),
  });
  const slug = stores?.items?.find((s: { id: string }) => s.id === storeId)?.slug as string | undefined;

  const { data: dash } = useQuery({
    queryKey: ["scheduling-dashboard"],
    queryFn: () => api.get("/scheduling/dashboard").then((r) => r.data),
    enabled: !!storeId,
  });

  const { data: appts } = useQuery({
    queryKey: ["scheduling-appointments"],
    queryFn: () => api.get("/scheduling/appointments").then((r) => r.data),
    enabled: !!storeId,
  });

  const { data: reviews } = useQuery({
    queryKey: ["scheduling-reviews"],
    queryFn: () => api.get("/scheduling/reviews").then((r) => r.data),
    enabled: !!storeId,
  });

  const publicBookUrl =
    typeof window !== "undefined" && slug ? `${window.location.origin}/book/${slug}` : slug ? `/book/${slug}` : "";

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Agenda</p>
          <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Agenda avanzada</h1>
          <p className="max-w-xl text-sm text-slate-500 dark:text-slate-400">
            Citas para belleza, salud y bienestar: sucursales, profesionales, servicios, disponibilidad y reserva publica.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-blue-600 dark:text-blue-400">
            <Link href="/scheduling/services" className="hover:underline">Menu de servicios</Link>
            <Link href="/scheduling/profesionales" className="hover:underline">Profesionales</Link>
            <Link href="/scheduling/sedes" className="hover:underline">Sedes</Link>
            <Link href="/scheduling/panel" className="hover:underline">Panel de atencion</Link>
          </div>
        </div>
        {publicBookUrl && (
          <a
            href={publicBookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-95"
          >
            <ExternalLink className="h-4 w-4" /> Abrir reserva publica
          </a>
        )}
      </div>

      <PageSectionMenu
        title="Menu de agenda"
        items={[
          { id: "resumen", label: "Resumen" },
          { id: "calificaciones", label: "Calificaciones" },
          { id: "citas", label: "Proximas citas" },
          { id: "recursos", label: "Recursos" },
        ]}
        activeId={activeSection}
        onChange={(id) => setActiveSection(id as "resumen" | "calificaciones" | "citas" | "recursos")}
      />

      {/* Resumen */}
      {activeSection === "resumen" && (
        <div className="mb-8">
          {!storeId ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50 py-16 text-center dark:border-amber-900/50 dark:bg-amber-950/20">
              <Calendar className="mb-3 h-10 w-10 text-amber-400" />
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Selecciona una tienda</p>
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Las metricas aparecen segun la tienda activa</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: BarChart3, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30",
                  label: "Ultimos 30 dias (aprox.)", value: dash?.appointments_total ?? "—", sub: "Citas totales en rango"
                },
                {
                  icon: DollarSign, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30",
                  label: "Ingresos estimados", value: dash?.revenue_cents_estimated != null ? fmtCLP(dash.revenue_cents_estimated) : "—", sub: "Citas confirmadas/completadas"
                },
                {
                  icon: XCircle, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-900/30",
                  label: "Canceladas / No-show",
                  value: dash ? `${dash.cancelled} / ${dash.no_show}` : "—",
                  sub: `Confirmadas: ${dash?.confirmed ?? "—"}`
                },
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{stat.label}</p>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{stat.value}</p>
                  <p className="mt-1 text-xs text-slate-400">{stat.sub}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calificaciones */}
      {activeSection === "calificaciones" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 dark:border-amber-900/50 dark:from-amber-950/30 dark:to-slate-900/80">
            <div className="mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" fill="currentColor" />
              <h2 className="font-bold text-slate-900 dark:text-white">Calificaciones de clientes</h2>
            </div>

            {reviews?.store?.count > 0 && reviews?.store?.average != null ? (
              <>
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold text-slate-900 dark:text-white">{reviews.store.average.toFixed(1)}</span>
                  <div>
                    <StarRating rating={reviews.store.average} />
                    <p className="mt-0.5 text-xs text-slate-500">{reviews.store.count} {reviews.store.count === 1 ? "opinion" : "opiniones"}</p>
                  </div>
                </div>

                {Array.isArray(reviews.by_professional) && reviews.by_professional.length > 0 && (
                  <div className="mb-4 border-t border-amber-200/60 pt-4 dark:border-amber-900/40">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Por profesional</p>
                    <ul className="space-y-2">
                      {(reviews.by_professional as { professional_id: string; name: string; average: number; count: number }[]).map((row) => (
                        <li key={row.professional_id} className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-2 dark:bg-slate-900/40">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                              {row.name?.charAt(0) ?? "P"}
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{row.name || "Profesional"}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StarRating rating={row.average ?? 0} />
                            <span className="text-xs text-slate-500">{row.count}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {reviews.items?.length > 0 && (
                  <div className="border-t border-amber-200/60 pt-4 dark:border-amber-900/40">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ultimas opiniones</p>
                    <ul className="space-y-2">
                      {reviews.items.slice(0, 5).map((it: { id: string; rating: number; comment: string | null; professional_name: string; created_at: string }) => (
                        <li key={it.id} className="rounded-xl bg-white/70 p-3 dark:bg-slate-900/50">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <StarRating rating={it.rating} />
                            <span className="text-xs text-slate-500">{it.professional_name}</span>
                          </div>
                          {it.comment && <p className="text-sm text-slate-700 dark:text-slate-200">{it.comment}</p>}
                          <p className="mt-1 text-[10px] text-slate-400">{new Date(it.created_at).toLocaleString("es-CL")}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Star className="mb-3 h-10 w-10 text-amber-200" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sin calificaciones aun</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Los clientes pueden opinar desde el enlace de gestion de su cita</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Proximas citas */}
      {activeSection === "citas" && (
        <div className="mb-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" /> Proximas citas
            </h2>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              onClick={async () => {
                try {
                  const r = await api.get("/scheduling/appointments/export.csv", { responseType: "blob" });
                  const url = URL.createObjectURL(r.data);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "citas.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                } catch { /* ignore */ }
              }}
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          </div>

          {appts?.items?.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
              <Calendar className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Sin citas proximas</p>
              <p className="mt-1 text-xs text-slate-400">Las nuevas reservas apareceran aqui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {appts?.items?.slice(0, 20).map((a: {
                id: string; start_time: string; end_time: string; status: string;
                client_name: string; service_name: string; professional_name: string;
                service_price_cents: number | null; charged_price_cents: number | null;
              }) => {
                const stCfg = STATUS_CONFIG[a.status] ?? { label: a.status, variant: "slate" as const };
                const price = a.charged_price_cents ?? a.service_price_cents;
                return (
                  <div key={a.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                        <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {a.client_name || "—"}{" "}
                          {a.service_name && <span className="font-normal text-slate-400">· {a.service_name}</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(a.start_time).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                          {" → "}
                          {new Date(a.end_time).toLocaleTimeString("es-CL", { timeStyle: "short" })}
                          {a.professional_name && ` · ${a.professional_name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 ml-3">
                      {price != null && (
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{fmtCLP(price)}</span>
                      )}
                      <Badge variant={stCfg.variant}>{stCfg.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Recursos */}
      {activeSection === "recursos" && (
        <div className="mb-8 space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              <strong>Trabajadoras:</strong> vincula cada profesional a un usuario de la tienda (
              <code className="rounded bg-white/80 px-1 dark:bg-slate-800">/scheduling/professionals/&#123;id&#125;</code> con{" "}
              <code className="rounded bg-white/80 px-1">user_id</code>) para que vean solo sus citas en{" "}
              <Link href="/mi-agenda" className="font-semibold underline">Mi agenda</Link>.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">API REST</h3>
            <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
              <li><code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /scheduling/branches</code> — sucursales</li>
              <li><code className="rounded bg-slate-100 px-1 dark:bg-slate-800">POST /scheduling/availability-rules</code> — horarios</li>
              <li><code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /public/scheduling/&#123;slug&#125;/slots</code> — slots publicos</li>
            </ul>
            <p className="mt-4 text-xs text-slate-400">
              Recordatorios 24h/1h y cola de notificaciones se procesan en el worker de la API.
            </p>
            <p className="mt-2 text-xs">
              <Link href="/calendar" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                Agenda clasica (reuniones)
              </Link>
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
