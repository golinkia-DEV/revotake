"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Star, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import publicApi from "@/lib/publicApi";

export default function SiguiendoPage() {
  const { user, isLoading: authLoading } = usePublicAuth();
  const qc = useQueryClient();

  const { data: following = [], isLoading } = useQuery({
    queryKey: ["pub-following"],
    queryFn: () => publicApi.get("/public/user/following").then((r) => r.data),
    enabled: !!user,
    staleTime: 60_000,
  });

  const handleUnfollow = async (slug: string, name: string) => {
    try {
      await publicApi.delete(`/public/user/stores/${slug}/follow`);
      toast.success(`Dejaste de seguir ${name}`);
      qc.invalidateQueries({ queryKey: ["pub-following"] });
    } catch {
      toast.error("Error al dejar de seguir");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <Heart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-700 mb-1">Inicia sesión para ver tus tiendas</h2>
        <p className="text-sm text-gray-400 mb-4">Sigue tus tiendas favoritas y recibe sus novedades</p>
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
      <h1 className="text-xl font-bold text-gray-900 mb-4">
        Tiendas que sigo
        {following.length > 0 && (
          <span className="ml-2 text-sm text-gray-400 font-normal">({following.length})</span>
        )}
      </h1>

      {following.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Heart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aún no sigues ninguna tienda</p>
          <Link
            href="/explorar"
            className="inline-flex items-center gap-1 mt-4 text-sm text-violet-600 font-medium hover:underline"
          >
            Explorar tiendas <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {following.map((store: any) => (
            <div
              key={store.slug}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-violet-200 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {store.logo_url ? (
                    <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-violet-300 font-bold text-lg">{store.name?.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/tienda/${store.slug}`}
                    className="font-semibold text-sm text-gray-900 hover:text-violet-600 transition-colors block truncate"
                  >
                    {store.name}
                  </Link>
                  {store.store_type && (
                    <span className="text-xs text-violet-500">{store.store_type.name}</span>
                  )}
                  {store.rating_avg && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-xs text-gray-600">{store.rating_avg.toFixed(1)}</span>
                      <span className="text-xs text-gray-400">({store.rating_count})</span>
                    </div>
                  )}
                  {store.flash_deals_count > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Zap className="w-3 h-3 text-orange-400 fill-orange-300" />
                      <span className="text-xs text-orange-600 font-medium">
                        {store.flash_deals_count} oferta{store.flash_deals_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Link
                  href={`/tienda/${store.slug}`}
                  className="flex-1 text-center py-1.5 text-xs font-semibold text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors"
                >
                  Ver tienda
                </Link>
                <button
                  onClick={() => handleUnfollow(store.slug, store.name)}
                  className="px-3 py-1.5 text-xs text-gray-400 border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                >
                  <Heart className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
