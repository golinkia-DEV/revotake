"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Star, Calendar, CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import publicApi from "@/lib/publicApi";

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  confirmed: { label: "Confirmada", color: "text-green-600 bg-green-50", icon: CheckCircle },
  completed: { label: "Completada", color: "text-blue-600 bg-blue-50", icon: CheckCircle },
  cancelled: { label: "Cancelada", color: "text-red-500 bg-red-50", icon: XCircle },
  pending_payment: { label: "Pend. pago", color: "text-amber-600 bg-amber-50", icon: Clock },
  no_show: { label: "No asistió", color: "text-gray-500 bg-gray-100", icon: XCircle },
};

export default function MiHistorialPage() {
  const { user, isLoading: authLoading } = usePublicAuth();
  const router = useRouter();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["pub-history"],
    queryFn: () => publicApi.get("/public/user/history").then((r) => r.data),
    enabled: !!user,
    staleTime: 60_000,
  });

  if (authLoading || isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-700 mb-1">Inicia sesión para ver tu historial</h2>
        <p className="text-sm text-gray-400 mb-4">Tu historial de reservas aparecerá aquí</p>
        <Link
          href="/auth/ingresar"
          className="inline-block px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition-colors"
        >
          Ingresar
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Mi Historial</h1>

      {history.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aún no tienes reservas</p>
          <Link
            href="/explorar"
            className="inline-flex items-center gap-1 mt-3 text-sm text-violet-600 font-medium hover:underline"
          >
            Explorar tiendas <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((appt: any) => {
            const status = STATUS_MAP[appt.status] || { label: appt.status, color: "text-gray-500 bg-gray-100", icon: Clock };
            const StatusIcon = status.icon;
            const date = new Date(appt.start_time);

            return (
              <div
                key={appt.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-violet-200 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Store logo */}
                  <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {appt.store_logo ? (
                      <img src={appt.store_logo} alt={appt.store_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-violet-300 font-bold text-lg">{appt.store_name?.charAt(0)}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/tienda/${appt.store_slug}`}
                          className="font-semibold text-sm text-gray-900 hover:text-violet-600 transition-colors"
                        >
                          {appt.store_name}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {date.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                            {" — "}
                            {date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>

                    {/* Rating if exists */}
                    {appt.review && (
                      <div className="flex items-center gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`w-3 h-3 ${n <= appt.review.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"}`}
                          />
                        ))}
                        {appt.review.comment && (
                          <span className="text-xs text-gray-500 ml-1 italic truncate max-w-[200px]">
                            "{appt.review.comment}"
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 mt-2">
                      {appt.manage_token && (
                        <Link
                          href={`/book/manage/${appt.manage_token}`}
                          className="text-xs text-violet-600 font-medium hover:underline"
                        >
                          Ver reserva →
                        </Link>
                      )}
                      <Link
                        href={`/tienda/${appt.store_slug}`}
                        className="text-xs text-gray-400 hover:text-violet-600 transition-colors"
                      >
                        Reservar de nuevo
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
