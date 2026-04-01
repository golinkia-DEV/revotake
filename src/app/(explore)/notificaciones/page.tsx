"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Zap, Calendar, MapPin, ArrowRight, Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import publicApi from "@/lib/publicApi";

export default function NotificacionesPage() {
  const { user, isLoading: authLoading } = usePublicAuth();
  const qc = useQueryClient();
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pub-notifications"],
    queryFn: () => publicApi.get("/public/user/notifications").then((r) => r.data),
    enabled: !!user,
    staleTime: 60_000,
  });

  const flashDeals: any[] = data?.flash_deals ?? [];
  const events: any[] = data?.events ?? [];
  const total = flashDeals.length + events.length;

  const handleRSVP = async (eventId: string, status: "accepted" | "declined") => {
    if (!user) return;
    setRsvpLoading(eventId);
    try {
      await publicApi.post(`/public/user/events/${eventId}/rsvp`, { status });
      toast.success(status === "accepted" ? "¡Asistencia confirmada!" : "Respuesta enviada");
      qc.invalidateQueries({ queryKey: ["pub-notifications"] });
    } catch {
      toast.error("Error al responder");
    } finally {
      setRsvpLoading(null);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-700 mb-1">Inicia sesión para ver notificaciones</h2>
        <p className="text-sm text-gray-400 mb-4">Recibe alertas de ofertas y eventos de tus tiendas favoritas</p>
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Notificaciones</h1>
        {total > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold">
            {total} nueva{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {total === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin notificaciones por ahora</p>
          <p className="text-xs mt-1">Sigue tiendas para recibir ofertas y eventos</p>
          <Link
            href="/explorar"
            className="inline-flex items-center gap-1 mt-4 text-sm text-violet-600 font-medium hover:underline"
          >
            Explorar tiendas <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Flash Deals */}
          {flashDeals.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-orange-400" />
                Ofertas Flash
              </h2>
              <div className="space-y-2">
                {flashDeals.map((deal: any) => (
                  <div
                    key={deal.id}
                    className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {deal.store_logo ? (
                          <img src={deal.store_logo} alt={deal.store_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-orange-400 font-bold">{deal.store_name?.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/tienda/${deal.store_slug}`} className="text-sm font-semibold text-gray-800 hover:text-orange-600">
                            {deal.store_name}
                          </Link>
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold">
                            -{deal.discount_percent}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 font-medium mt-0.5">{deal.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Vence: {new Date(deal.expires_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                        </p>
                        <Link
                          href={`/tienda/${deal.store_slug}?tab=ofertas`}
                          className="inline-flex items-center gap-1 mt-2 text-xs text-orange-600 font-semibold hover:underline"
                        >
                          Tomar oferta <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Events */}
          {events.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-violet-500" />
                Invitaciones a Eventos
              </h2>
              <div className="space-y-2">
                {events.map((evt: any) => (
                  <div
                    key={evt.id}
                    className="bg-white border border-gray-200 rounded-xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 overflow-hidden">
                        {evt.store_logo ? (
                          <img src={evt.store_logo} alt={evt.store_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-violet-300 font-bold">{evt.store_name?.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/tienda/${evt.store_slug}`} className="text-sm font-semibold text-gray-800 hover:text-violet-600">
                          {evt.store_name}
                        </Link>
                        <p className="text-sm text-gray-700 mt-0.5 font-medium">{evt.title}</p>
                        <div className="flex items-center gap-1 text-xs text-violet-600 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(evt.event_date).toLocaleDateString("es-CL", {
                            weekday: "short", day: "numeric", month: "short",
                          })}
                          {" · "}
                          {new Date(evt.event_date).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {evt.location_text && (
                          <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-3 h-3" /> {evt.location_text}
                          </p>
                        )}
                        {evt.rsvp_status ? (
                          <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                            evt.rsvp_status === "accepted" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}>
                            {evt.rsvp_status === "accepted" ? "✓ Confirmaste asistencia" : "✗ No puedes asistir"}
                          </span>
                        ) : (
                          <div className="flex gap-1.5 mt-2">
                            <button
                              onClick={() => handleRSVP(evt.id, "accepted")}
                              disabled={rsvpLoading === evt.id}
                              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60"
                            >
                              <Check className="w-3 h-3" /> Aceptar
                            </button>
                            <button
                              onClick={() => handleRSVP(evt.id, "declined")}
                              disabled={rsvpLoading === evt.id}
                              className="flex items-center gap-1 px-3 py-1 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
                            >
                              <X className="w-3 h-3" /> No puedo
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
