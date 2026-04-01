"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Star, MapPin, Clock, Phone, PawPrint, Truck, Wifi, Coffee,
  Heart, HeartOff, CalendarCheck, Zap, Calendar, MessageSquare,
  ChevronLeft, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import publicApi from "@/lib/publicApi";
import { usePublicAuth } from "@/contexts/PublicAuthContext";

type Tab = "info" | "servicios" | "resenas" | "eventos" | "ofertas";

const TABS: { id: Tab; label: string }[] = [
  { id: "info", label: "Información" },
  { id: "servicios", label: "Servicios" },
  { id: "resenas", label: "Reseñas" },
  { id: "eventos", label: "Eventos" },
  { id: "ofertas", label: "Ofertas Flash" },
];

function StarRating({ value, count }: { value: number; count: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-4 h-4 ${n <= Math.round(value) ? "text-amber-400 fill-amber-400" : "text-gray-200"}`}
        />
      ))}
      <span className="ml-1 font-semibold text-gray-800">{value.toFixed(1)}</span>
      <span className="text-gray-400 text-sm">({count} reseñas)</span>
    </div>
  );
}

export default function TiendaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = usePublicAuth();
  const [tab, setTab] = useState<Tab>("info");
  const [followed, setFollowed] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const qc = useQueryClient();

  // Meta de la tienda
  const { data: meta, isLoading } = useQuery({
    queryKey: ["pub-meta", slug],
    queryFn: () => publicApi.get(`/public/scheduling/${slug}/meta`).then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  // Ratings
  const { data: ratings } = useQuery({
    queryKey: ["pub-ratings", slug],
    queryFn: () => publicApi.get(`/public/scheduling/${slug}/ratings-summary`).then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  // Servicios
  const { data: services = [] } = useQuery({
    queryKey: ["pub-svc", slug],
    queryFn: () => publicApi.get(`/public/scheduling/${slug}/services`).then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  // Eventos
  const { data: events = [] } = useQuery({
    queryKey: ["pub-events", slug],
    queryFn: () => publicApi.get(`/public/explore/stores/${slug}/events`).then((r) => r.data),
    staleTime: 2 * 60_000,
  });

  // Flash deals
  const { data: flashDeals = [] } = useQuery({
    queryKey: ["pub-flash-deals", slug],
    queryFn: () => publicApi.get(`/public/scheduling/${slug}/flash-deals`).then((r) => r.data),
    staleTime: 60_000,
  });

  const handleFollow = async () => {
    if (!user) { toast.error("Inicia sesión para seguir tiendas"); return; }
    try {
      if (followed) {
        await publicApi.delete(`/public/user/stores/${slug}/follow`);
        setFollowed(false);
        toast.success("Dejaste de seguir la tienda");
      } else {
        await publicApi.post(`/public/user/stores/${slug}/follow`);
        setFollowed(true);
        toast.success("¡Tienda seguida!");
      }
    } catch {
      toast.error("Error al actualizar seguimiento");
    }
  };

  const handleRSVP = async (eventId: string, status: "accepted" | "declined") => {
    if (!user) { toast.error("Inicia sesión para responder eventos"); return; }
    setRsvpLoading(eventId);
    try {
      await publicApi.post(`/public/user/events/${eventId}/rsvp`, { status });
      toast.success(status === "accepted" ? "¡Confirmarás asistencia!" : "Respuesta enviada");
      qc.invalidateQueries({ queryKey: ["pub-events", slug] });
    } catch {
      toast.error("Error al responder evento");
    } finally {
      setRsvpLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        {[80, 40, 120].map((h, i) => (
          <div key={i} className={`h-${h === 80 ? "20" : h === 40 ? "10" : "32"} rounded-xl bg-gray-200 animate-pulse`} />
        ))}
      </div>
    );
  }

  const loc = meta?.public_block?.location_public || {};
  const horarios = meta?.public_block?.horarios || {};
  const amenities = meta?.public_block?.amenities || {};
  const storeRating = ratings?.store;

  // Agrupar servicios por categoría
  const servicesByCategory: Record<string, any[]> = {};
  (Array.isArray(services) ? services : []).forEach((svc: any) => {
    const cat = svc.category || "General";
    if (!servicesByCategory[cat]) servicesByCategory[cat] = [];
    servicesByCategory[cat].push(svc);
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-16">
      {/* Back */}
      <Link href="/explorar" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-violet-600 mb-4 transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Volver al explorador
      </Link>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
        <div className="h-2 bg-gradient-to-r from-violet-500 to-purple-600" />
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-2xl bg-violet-50 border border-violet-100 overflow-hidden flex items-center justify-center shrink-0">
              {meta?.logo_url ? (
                <img src={meta.logo_url} alt={meta?.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-violet-300">
                  {meta?.name?.charAt(0) ?? "?"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{meta?.name}</h1>
              {storeRating && storeRating.count > 0 && (
                <div className="mt-1">
                  <StarRating value={storeRating.avg} count={storeRating.count} />
                </div>
              )}
              {loc.comuna && (
                <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                  <MapPin className="w-3.5 h-3.5" />
                  {loc.comuna}{loc.region ? `, ${loc.region}` : ""}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleFollow}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                followed
                  ? "border-violet-400 bg-violet-50 text-violet-700"
                  : "border-gray-200 text-gray-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
              }`}
            >
              {followed ? <HeartOff className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
              {followed ? "Siguiendo" : "Seguir"}
            </button>
            <Link
              href={`/book/${slug}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              <CalendarCheck className="w-4 h-4" />
              Reservar
            </Link>
            {loc.google_maps_url && (
              <a
                href={loc.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Maps
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-white text-violet-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        {/* INFO */}
        {tab === "info" && (
          <div className="space-y-5">
            {loc.direccion_atencion && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-violet-500" /> Dirección
                </h3>
                <p className="text-sm text-gray-600">{loc.direccion_atencion}</p>
                {loc.referencias_acceso && (
                  <p className="text-xs text-gray-400 mt-1">{loc.referencias_acceso}</p>
                )}
              </div>
            )}

            {(horarios.lun_vie || horarios.sabado || horarios.domingo_feriados) && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-violet-500" /> Horarios
                </h3>
                <div className="space-y-1 text-sm text-gray-600">
                  {horarios.lun_vie && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Lun — Vie</span>
                      <span className="font-medium">{horarios.lun_vie}</span>
                    </div>
                  )}
                  {horarios.sabado && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sábado</span>
                      <span className="font-medium">{horarios.sabado}</span>
                    </div>
                  )}
                  {horarios.domingo_feriados && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Dom / Feriados</span>
                      <span className="font-medium">{horarios.domingo_feriados}</span>
                    </div>
                  )}
                  {horarios.notas && (
                    <p className="text-xs text-gray-400 mt-2">{horarios.notas}</p>
                  )}
                </div>
              </div>
            )}

            {/* Amenidades */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-violet-500" /> Comodidades
              </h3>
              <div className="flex flex-wrap gap-2">
                {amenities.mascotas_bienvenidas && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-200">
                    <PawPrint className="w-3 h-3" /> Pet Friendly
                  </span>
                )}
                {amenities.domicilio && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                    <Truck className="w-3 h-3" /> A domicilio
                  </span>
                )}
                {amenities.wifi && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200">
                    <Wifi className="w-3 h-3" /> WiFi
                  </span>
                )}
                {amenities.cafeteria && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
                    <Coffee className="w-3 h-3" /> Cafetería
                  </span>
                )}
                {amenities.pago_tarjeta && (
                  <span className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200">
                    💳 Pago con tarjeta
                  </span>
                )}
                {amenities.estacionamiento && amenities.estacionamiento !== "no" && (
                  <span className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200">
                    🅿️ Estacionamiento {amenities.estacionamiento === "si_gratis" ? "gratis" : amenities.estacionamiento === "si_pago" ? "de pago" : "limitado"}
                  </span>
                )}
                {amenities.zona_infantil && (
                  <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-200">
                    👶 Zona infantil
                  </span>
                )}
                {amenities.acceso_movilidad && (
                  <span className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200">
                    ♿ Acceso movilidad reducida
                  </span>
                )}
              </div>
              {amenities.otras_comodidades && (
                <p className="text-xs text-gray-400 mt-2">{amenities.otras_comodidades}</p>
              )}
            </div>
          </div>
        )}

        {/* SERVICIOS */}
        {tab === "servicios" && (
          <div className="space-y-6">
            {Object.keys(servicesByCategory).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No hay servicios disponibles</p>
            ) : (
              Object.entries(servicesByCategory).map(([cat, svcs]) => (
                <div key={cat}>
                  <h3 className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-2">{cat}</h3>
                  <div className="space-y-2">
                    {svcs.map((svc: any) => (
                      <div
                        key={svc.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800">{svc.name}</p>
                          {svc.description && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{svc.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            <Clock className="w-3 h-3 inline mr-0.5" />
                            {svc.duration_minutes} min
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-sm font-bold text-gray-900">
                            ${(svc.price_cents / 100).toLocaleString("es-CL")}
                          </p>
                          <Link
                            href={`/book/${slug}`}
                            className="text-xs text-violet-600 font-medium hover:underline"
                          >
                            Reservar →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* RESEÑAS */}
        {tab === "resenas" && (
          <div className="space-y-4">
            {storeRating?.reviews?.length === 0 || !storeRating?.reviews ? (
              <p className="text-sm text-gray-400 text-center py-4">Aún no hay reseñas</p>
            ) : (
              storeRating.reviews?.map((review: any, i: number) => (
                <div key={i} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`w-3.5 h-3.5 ${n <= review.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"}`}
                      />
                    ))}
                    <span className="text-xs text-gray-400 ml-1">
                      {new Date(review.created_at).toLocaleDateString("es-CL")}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-gray-700">{review.comment}</p>
                  )}
                </div>
              ))
            )}
            <div className="pt-2 border-t border-gray-100">
              <Link
                href={`/book/${slug}`}
                className="text-sm text-violet-600 font-medium hover:underline"
              >
                <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
                Haz tu reserva y deja tu reseña
              </Link>
            </div>
          </div>
        )}

        {/* EVENTOS */}
        {tab === "eventos" && (
          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No hay eventos próximos</p>
            ) : (
              events.map((evt: any) => (
                <div
                  key={evt.id}
                  className="rounded-xl border border-gray-200 overflow-hidden"
                >
                  {evt.image_url && (
                    <img
                      src={evt.image_url}
                      alt={evt.title}
                      className="w-full h-32 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <h4 className="font-semibold text-gray-800">{evt.title}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-violet-600 mt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(evt.event_date).toLocaleDateString("es-CL", {
                        weekday: "long", year: "numeric", month: "long", day: "numeric",
                      })}
                    </div>
                    {evt.location_text && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {evt.location_text}
                      </p>
                    )}
                    {evt.description && (
                      <p className="text-sm text-gray-600 mt-2">{evt.description}</p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleRSVP(evt.id, "accepted")}
                        disabled={rsvpLoading === evt.id}
                        className="flex-1 py-1.5 text-sm font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-60"
                      >
                        ✓ Aceptar
                      </button>
                      <button
                        onClick={() => handleRSVP(evt.id, "declined")}
                        disabled={rsvpLoading === evt.id}
                        className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
                      >
                        No puedo
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* OFERTAS FLASH */}
        {tab === "ofertas" && (
          <div className="space-y-3">
            {flashDeals.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No hay ofertas activas</p>
            ) : (
              flashDeals.map((deal: any) => (
                <div
                  key={deal.id}
                  className="rounded-xl border border-orange-200 bg-orange-50 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Zap className="w-4 h-4 text-orange-500 fill-orange-400" />
                        <span className="text-sm font-bold text-orange-700">
                          {deal.discount_percent}% descuento
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-800">{deal.title}</h4>
                      {deal.description && (
                        <p className="text-xs text-gray-600 mt-1">{deal.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        <Clock className="w-3 h-3 inline mr-0.5" />
                        {new Date(deal.slot_start_time).toLocaleDateString("es-CL")} —{" "}
                        {new Date(deal.slot_start_time).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400 line-through">
                        ${(deal.original_price_cents / 100).toLocaleString("es-CL")}
                      </p>
                      <p className="text-base font-bold text-orange-700">
                        ${Math.round(deal.original_price_cents * (1 - deal.discount_percent / 100) / 100).toLocaleString("es-CL")}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/book/${slug}?deal=${deal.id}`}
                    className="mt-3 block text-center py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
                  >
                    Tomar esta oferta
                  </Link>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
