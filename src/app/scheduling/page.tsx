"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, ExternalLink, BarChart3, ClipboardList, Download } from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { getStoreId } from "@/lib/store";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export default function SchedulingAdminPage() {
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

  const publicBookUrl =
    typeof window !== "undefined" && slug ? `${window.location.origin}/book/${slug}` : slug ? `/book/${slug}` : "";

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-on-surface">Agenda avanzada</h1>
          <p className="max-w-xl text-sm text-slate-500">
            Sucursales, profesionales, servicios, disponibilidad y reservas públicas. Métricas y export CSV desde la API.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-primary">
            <Link href="/scheduling/services" className="hover:underline">
              Menú de servicios (categorías y precios)
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
            <MaterialIcon name="payments" className="text-lg" /> Ingresos estimados
          </div>
          <p className="text-2xl font-extrabold text-on-surface">
            {dash?.revenue_cents_estimated != null ? `${dash.revenue_cents_estimated}` : "—"}
          </p>
          <p className="text-xs text-slate-500">Suma precio servicio (citas confirmadas/completadas)</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card-hover p-5"
        >
          <div className="mb-2 text-sm font-semibold text-slate-600">Canceladas / No-show</div>
          <p className="text-2xl font-extrabold text-on-surface">
            {dash ? `${dash.cancelled} / ${dash.no_show}` : "—"}
          </p>
          <p className="text-xs text-slate-500">Confirmadas: {dash?.confirmed ?? "—"}</p>
        </motion.div>
      </div>

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
        {appts?.items?.slice(0, 20).map((a: { id: string; start_time: string; status: string; service_id: string }) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50"
          >
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-semibold text-on-surface">{new Date(a.start_time).toLocaleString("es-CL")}</p>
                <p className="text-xs text-slate-500">{a.status}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-amber-100 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
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
    </AppLayout>
  );
}
