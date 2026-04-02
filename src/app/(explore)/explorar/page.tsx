"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, PawPrint, Truck, SlidersHorizontal, X, Star, Tag } from "lucide-react";
import publicApi from "@/lib/publicApi";
import StoreCard, { type StoreCardData } from "@/components/public/StoreCard";
import dynamic from "next/dynamic";

// MapView se carga solo en cliente (Leaflet no soporta SSR)
const MapView = dynamic(() => import("@/components/public/MapView"), { ssr: false });

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function ExplorarPage() {
  const [search, setSearch] = useState("");
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [petFriendly, setPetFriendly] = useState(false);
  const [delivery, setDelivery] = useState(false);
  const [hasDeals, setHasDeals] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [sort, setSort] = useState<"rating" | "distance" | "deals">("rating");
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement>>({});

  // Geolocalización
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // silencioso si se niega
      );
    }
  }, []);

  // Categorías
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["pub-categories"],
    queryFn: () => publicApi.get("/public/explore/categories").then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  // Tiendas
  const params: Record<string, string | number | boolean> = { limit: 50, sort };
  if (search) params.search = search;
  if (categorySlug) params.category_slug = categorySlug;
  if (petFriendly) params.pet_friendly = true;
  if (delivery) params.delivery = true;
  if (hasDeals) params.has_deals = true;
  if (minRating) params.min_rating = minRating;
  if (userLocation) {
    params.lat = userLocation.lat;
    params.lng = userLocation.lng;
    params.radius_km = 100;
  }

  const { data: storesData, isLoading } = useQuery({
    queryKey: ["pub-stores", search, categorySlug, petFriendly, delivery, hasDeals, minRating, sort, userLocation],
    queryFn: () => publicApi.get("/public/explore/stores", { params }).then((r) => r.data),
    staleTime: 60_000,
  });

  const stores: StoreCardData[] = storesData?.items ?? [];

  // Scroll la lista hacia la tarjeta cuando se hace click en el mapa
  const handleMarkerClick = useCallback((slug: string) => {
    setHighlightedSlug(slug);
    const el = cardRefs.current[slug];
    if (el && listRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  const activeFilters = [petFriendly, delivery, hasDeals, !!categorySlug, !!minRating].filter(Boolean).length;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex flex-col gap-2">
        {/* Search + filter toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar tienda..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              activeFilters > 0
                ? "border-violet-400 bg-violet-50 text-violet-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {activeFilters > 0 && (
              <span className="w-4 h-4 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Categories */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          <button
            onClick={() => setCategorySlug(null)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              !categorySlug
                ? "bg-violet-600 text-white border-violet-600"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setCategorySlug(cat.slug === categorySlug ? null : cat.slug)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                categorySlug === cat.slug
                  ? "bg-violet-600 text-white border-violet-600"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Filters row */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
            <button
              onClick={() => setPetFriendly(!petFriendly)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                petFriendly
                  ? "bg-green-50 border-green-400 text-green-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <PawPrint className="w-3.5 h-3.5" />
              Pet Friendly
            </button>
            <button
              onClick={() => setDelivery(!delivery)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                delivery
                  ? "bg-blue-50 border-blue-400 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              A domicilio
            </button>
            <button
              onClick={() => setHasDeals(!hasDeals)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                hasDeals
                  ? "bg-orange-50 border-orange-400 text-orange-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              Con ofertas
            </button>
            <select
              value={minRating ?? ""}
              onChange={(e) => setMinRating(e.target.value ? Number(e.target.value) : null)}
              className={`px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-300 ${
                minRating
                  ? "border-yellow-400 bg-yellow-50 text-yellow-700"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              <option value="">Cualquier rating</option>
              <option value="3">3+ estrellas</option>
              <option value="4">4+ estrellas</option>
              <option value="4.5">4.5+ estrellas</option>
            </select>
            {userLocation && (
              <button
                onClick={() => setSort("distance")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  sort === "distance"
                    ? "bg-violet-50 border-violet-400 text-violet-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                Más cercanas
              </button>
            )}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "rating" | "distance" | "deals")}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-300"
            >
              <option value="rating">Mejor calificadas</option>
              <option value="distance">Más cercanas</option>
              <option value="deals">Con más ofertas</option>
            </select>
            {activeFilters > 0 && (
              <button
                onClick={() => {
                  setPetFriendly(false);
                  setDelivery(false);
                  setHasDeals(false);
                  setMinRating(null);
                  setCategorySlug(null);
                  setSort("rating");
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="w-3 h-3" />
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Split panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: store list */}
        <div
          ref={listRef}
          className="w-full md:w-[400px] lg:w-[440px] shrink-0 overflow-y-auto bg-gray-50 border-r border-gray-200"
        >
          {isLoading ? (
            <div className="p-4 flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-gray-200 animate-pulse" />
              ))}
            </div>
          ) : stores.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No se encontraron tiendas</p>
              <p className="text-xs mt-1">Intenta con otros filtros o amplía la búsqueda</p>
            </div>
          ) : (
            <div className="p-3 flex flex-col gap-2">
              <p className="text-xs text-gray-400 px-1">
                {stores.length} tienda{stores.length !== 1 ? "s" : ""} encontrada
                {stores.length !== 1 ? "s" : ""}
              </p>
              {stores.map((store) => (
                <div
                  key={store.slug}
                  ref={(el) => { if (el) cardRefs.current[store.slug] = el; }}
                >
                  <StoreCard
                    store={store}
                    isHighlighted={highlightedSlug === store.slug}
                    onHover={setHighlightedSlug}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: map */}
        <div className="hidden md:block flex-1 bg-gray-100 p-2">
          <MapView
            stores={stores}
            highlightedSlug={highlightedSlug}
            onMarkerClick={handleMarkerClick}
            userLocation={userLocation}
          />
        </div>
      </div>
    </div>
  );
}
