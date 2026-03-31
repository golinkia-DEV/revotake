"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, ExternalLink, BarChart3, ClipboardList, Download, Star, TrendingUp, XCircle } from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { getStoreId } from "@/lib/store";
import Link from "next/link";
import PageSectionMenu from "@/components/ui/PageSectionMenu";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-slate-100 text-slate-700" },
  confirmed: { label: "Confirmada", cls: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Cancelada", cls: "bg-red-100 text-red-800" },
  completed: { label: "Completada", cls: "bg-blue-100 text-blue-800" },
  no_show: { label: "No-show", cls: "bg-orange-100 text-orange-800" },
  pending_payment: { label: "Pago pendiente", cls: "bg-amber-100 text-amber-800" },
};

function fmtCLP(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
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
      <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl text-on-surface">Agenda avanzada</h1>
          <p className="max-w-xl text-sm text-slate-500">
            Citas para belleza, salud y bienestar: sucursales, profesionales, menú de servicios con fotos, disponibilidad y
            reserva pública. Métricas y export CSV desde la API.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-primary">
            <Link href="/scheduling/services" className="hover:underline">
              Menú de servicios (categorías y precios)
            </Link>
            <Link href="/scheduling/profesionales" className="hover:underline">
              Crear profesional (sedes + servicios)
            </Link>
            <Link href="/scheduling/sedes" className="hover:underline">
              Sedes (regiones, comunas) y sedes por profesional
            </Link>
            <Link href="/scheduling/panel" className="hover:underline">
              Panel de atención
            </Link>
          </div>
        </div>
        {publicBookUrl && (
          <a
            href={publicBookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25"
          >
            <ExternalLink className="h-4 w-4" /> Abrir reserva pública
          </a>
        )}
      </div>

      <PageSectionMenu
        title="Menú de agenda"
        items={[
          { id: "resumen", label: "Resumen" },
          { id: "calificaciones", label: "Calificaciones" },
          { id: "citas", label: "Próximas citas" },
          { id: "recursos", label: "Recursos" },
        ]}
        activeId={activeSection}
        onChange={(id) => setActiveSection(id as "resumen" | "calificaciones" | "citas" | "recursos")}
      />

      {activeSection === "resumen" && (
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card-hover p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-600">
            <BarChart3 className="h-4 w-4" /> Últimos 30 días (aprox.)
          </div>
          <p className="text-2xl font-extrabold text-on-surface">{dash?.appointments_total ?? "—"}</p>
          <p className="text-xs text-slate-500">Citas totales en rango</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card-hover p-5"
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-600">
            <TrendingUp className="h-4 w-4" /> Ingresos estimados
          </div>
          <p className="text-2xl font-extrabold text-on-surface">
            {dash?.revenue_cents_estimated != null ? fmtCLP(dash.revenue_cents_estimated) : "—"}
          </p>
          <p className="text-xs text-slate-500">Suma precio servicio (citas confirmadas/completadas)</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card-hover p-5"
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-600">
            <XCircle className="h-4 w-4" /> Canceladas / No-show
          </div>
          <p className="text-2xl font-extrabold text-on-surface">
            {dash ? `${dash.cancelled} / ${dash.no_show}` : "—"}
          </p>
          <p className="text-xs text-slate-500">Confirmadas: {dash?.confirmed ?? "—"}</p>
        </motion.div>
      </div>
      )}

      {activeSection === "calificaciones" && (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mb-8 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white p-5 dark:border-amber-900/50 dark:from-amber-950/40 dark:to-slate-900/80"
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-amber-100">
          <Star className="h-5 w-5 text-amber-500" fill="currentColor" />
          Calificaciones de clientes
        </div>
        {reviews?.store?.count > 0 && reviews?.store?.average != null ? (
          <>
            <p className="text-2xl font-extrabold text-on-surface">
              {reviews.store.average.toFixed(1)}
              <span className="ml-2 text-lg font-semibold text-amber-500">★</span>
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({reviews.store.count} {reviews.store.count === 1 ? "opinión" : "opiniones"})
              </span>
            </p>
            {Array.isArray(reviews.by_professional) && reviews.by_professional.length > 0 && (
              <div className="mt-4 border-t border-amber-200/60 pt-3 dark:border-amber-900/40">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Por profesional
                </p>
                <ul className="max-h-36 space-y-1.5 overflow-y-auto text-sm">
                  {(reviews.by_professional as { professional_id: string; name: string; average: number; count: number }[]).map(
                    (row) => (
                      <li key={row.professional_id} className="flex justify-between gap-2 text-slate-700 dark:text-slate-200">
                        <span className="min-w-0 truncate font-medium">{row.name || "Profesional"}</span>
                        <span className="shrink-0">
                          {row.average?.toFixed(1) ?? "—"} ★ · {row.count}
                        </span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
            {reviews.items?.length > 0 && (
              <div className="mt-4 border-t border-amber-200/60 pt-3 dark:border-amber-900/40">
                <p className="mb-2 text-xs font-semibold text-slate-500">Últimas opiniones</p>
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  {reviews.items.slice(0, 5).map((it: { id: string; rating: number; comment: string | null; professional_name: string; created_at: string }) => (
                    <li key={it.id} className="rounded-lg bg-white/60 p-2 dark:bg-slate-950/50">
                      <span className="font-semibold text-amber-600">{"★".repeat(it.rating)}</span>{" "}
                      <span className="text-slate-500">{it.professional_name}</span>
                      {it.comment && <p className="mt-1 text-slate-700 dark:text-slate-200">{it.comment}</p>}
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {new Date(it.created_at).toLocaleString("es-CL")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Aún no hay calificaciones. Los clientes pueden opinar desde el enlace de gestión de su cita, después del horario
            de atención.
          </p>
        )}
      </motion.div>
      )}

      {activeSection === "citas" && (
      <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-on-surface">
          <ClipboardList className="h-5 w-5 text-primary" /> Próximas citas
        </h2>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          onClick={async () => {
            try {
              const r = await api.get("/scheduling/appointments/export.csv", { responseType: "blob" });
              const url = URL.createObjectURL(r.data);
              const a = document.createElement("a");
              a.href = url;
              a.download = "citas.csv";
              a.click();
              URL.revokeObjectURL(url);
            } catch {
              /* ignore */
            }
          }}
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
      </div>

      <div className="space-y-3">
        {appts?.items?.length === 0 && <p className="text-sm text-slate-500">No hay citas aún.</p>}
        {appts?.items?.slice(0, 20).map((a: {
          id: string;
          start_time: string;
          end_time: string;
          status: string;
          client_name: string;
          service_name: string;
          professional_name: string;
          service_price_cents: number | null;
          charged_price_cents: number | null;
        }) => {
          const st = STATUS_LABEL[a.status] ?? { label: a.status, cls: "bg-slate-100 text-slate-700" };
          const price = a.charged_price_cents ?? a.service_price_cents;
          return (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Calendar className="h-5 w-5 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface">
                    {a.client_name || "—"}{" "}
                    {a.service_name && <span className="font-normal text-slate-500">· {a.service_name}</span>}
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
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}

      {activeSection === "recursos" && (
      <>
      <div className="mt-2 rounded-2xl border border-amber-100 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <p className="text-sm text-amber-950 dark:text-amber-100">
          <strong>Trabajadoras:</strong> vinculá cada profesional a un usuario de la tienda (PATCH{" "}
          <code className="rounded bg-white/80 px-1 dark:bg-slate-800">/scheduling/professionals/&#123;id&#125;</code> con{" "}
          <code className="rounded bg-white/80 px-1">user_id</code>) para que vean solo sus citas en{" "}
          <Link href="/mi-agenda" className="font-semibold text-amber-900 underline dark:text-amber-200">
            Mi agenda
          </Link>
          .
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 dark:border-slate-800">
        <h3 className="mb-2 font-semibold text-on-surface">API REST</h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
          <li>
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /scheduling/branches</code> — sucursales
          </li>
          <li>
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">POST /scheduling/availability-rules</code> —
            horarios
          </li>
          <li>
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /public/scheduling/&#123;slug&#125;/slots</code>{" "}
            — slots públicos
          </li>
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          Recordatorios 24h/1h y cola de notificaciones se procesan en el worker de la API. Webhooks:{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/webhooks/scheduling/stripe</code>
        </p>
        <p className="mt-2 text-xs">
          <Link href="/calendar" className="font-semibold text-primary hover:underline">
            Agenda clásica (reuniones)
          </Link>
        </p>
      </div>
      </>
      )}
    </AppLayout>
  );
}
