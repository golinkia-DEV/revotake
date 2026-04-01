"use client";

import Link from "next/link";
import { MapPin, Star, Heart, HeartOff, Truck, PawPrint, Zap } from "lucide-react";
import { useState } from "react";
import publicApi from "@/lib/publicApi";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import { toast } from "sonner";

export interface StoreCardData {
  slug: string;
  name: string;
  logo_url: string | null;
  store_type: { name: string; slug: string } | null;
  location: { address: string; comuna: string; lat: number | null; lng: number | null };
  rating_avg: number | null;
  rating_count: number;
  pet_friendly: boolean;
  delivery: boolean;
  flash_deals_count: number;
  distance_km: number | null;
  isFollowed?: boolean;
}

interface Props {
  store: StoreCardData;
  isHighlighted?: boolean;
  onHover?: (slug: string | null) => void;
}

export default function StoreCard({ store, isHighlighted, onHover }: Props) {
  const { user } = usePublicAuth();
  const [followed, setFollowed] = useState(store.isFollowed ?? false);
  const [loadingFollow, setLoadingFollow] = useState(false);

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Inicia sesión para seguir tiendas");
      return;
    }
    setLoadingFollow(true);
    try {
      if (followed) {
        await publicApi.delete(`/public/user/stores/${store.slug}/follow`);
        setFollowed(false);
        toast.success("Dejaste de seguir la tienda");
      } else {
        await publicApi.post(`/public/user/stores/${store.slug}/follow`);
        setFollowed(true);
        toast.success("¡Tienda seguida!");
      }
    } catch {
      toast.error("Error al actualizar seguimiento");
    } finally {
      setLoadingFollow(false);
    }
  };

  return (
    <Link
      href={`/tienda/${store.slug}`}
      onMouseEnter={() => onHover?.(store.slug)}
      onMouseLeave={() => onHover?.(null)}
      className={`block rounded-xl border bg-white transition-all hover:shadow-md ${
        isHighlighted
          ? "border-violet-400 shadow-md ring-2 ring-violet-200"
          : "border-gray-200 hover:border-violet-200"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Logo */}
          <div className="w-14 h-14 rounded-xl bg-violet-50 shrink-0 overflow-hidden flex items-center justify-center border border-violet-100">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-violet-400 font-bold text-xl">
                {store.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">
                  {store.name}
                </h3>
                {store.store_type && (
                  <span className="text-xs text-violet-600 font-medium">{store.store_type.name}</span>
                )}
              </div>
              <button
                onClick={handleFollow}
                disabled={loadingFollow}
                className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                  followed
                    ? "text-violet-600 bg-violet-50 hover:bg-red-50 hover:text-red-500"
                    : "text-gray-400 hover:text-violet-600 hover:bg-violet-50"
                }`}
              >
                {followed ? <HeartOff className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
              </button>
            </div>

            {/* Rating */}
            {store.rating_avg !== null && (
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="text-sm font-semibold text-gray-800">
                  {store.rating_avg.toFixed(1)}
                </span>
                <span className="text-xs text-gray-400">({store.rating_count})</span>
              </div>
            )}

            {/* Location */}
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500 truncate">
                {store.location.comuna || store.location.address || "Ubicación no especificada"}
                {store.distance_km !== null && (
                  <span className="ml-1 text-violet-500 font-medium">· {store.distance_km} km</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {store.pet_friendly && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-200">
              <PawPrint className="w-3 h-3" />
              Pet Friendly
            </span>
          )}
          {store.delivery && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
              <Truck className="w-3 h-3" />
              A domicilio
            </span>
          )}
          {store.flash_deals_count > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs font-medium border border-orange-200">
              <Zap className="w-3 h-3 fill-orange-500" />
              {store.flash_deals_count} oferta{store.flash_deals_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
