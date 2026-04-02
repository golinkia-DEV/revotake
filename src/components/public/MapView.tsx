"use client";

import { useEffect, useRef } from "react";
import type { StoreCardData } from "./StoreCard";

interface Props {
  stores: StoreCardData[];
  highlightedSlug: string | null;
  onMarkerClick: (slug: string) => void;
  userLocation: { lat: number; lng: number } | null;
}

declare global {
  interface Window {
    google: typeof google;
    _gmapsLoaded?: boolean;
    _gmapsCallbacks?: Array<() => void>;
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (window._gmapsLoaded) {
      resolve();
      return;
    }
    if (window._gmapsCallbacks) {
      window._gmapsCallbacks.push(resolve);
      return;
    }
    window._gmapsCallbacks = [resolve];
    (window as any)._onGMapsLoad = () => {
      window._gmapsLoaded = true;
      window._gmapsCallbacks?.forEach((cb) => cb());
      window._gmapsCallbacks = [];
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=_onGMapsLoad&loading=async`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
}

export default function MapView({ stores, highlightedSlug, onMarkerClick, userLocation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Record<string, google.maps.Marker>>({});
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
    if (!apiKey || apiKey === "your_google_maps_api_key_here") {
      containerRef.current.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;font-size:13px">Google Maps API key no configurada</div>';
      return;
    }

    loadGoogleMaps(apiKey).then(() => {
      if (!containerRef.current) return;

      const center = userLocation
        ? { lat: userLocation.lat, lng: userLocation.lng }
        : { lat: -33.4569, lng: -70.6483 }; // Santiago por defecto

      // Inicializar mapa solo una vez
      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(containerRef.current, {
          center,
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
          ],
        });
        infoWindowRef.current = new google.maps.InfoWindow();

        // Marcador de usuario
        if (userLocation) {
          new google.maps.Marker({
            position: userLocation,
            map: mapRef.current,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: "#6d28d9",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
              scale: 8,
            },
            title: "Tu ubicación",
            zIndex: 999,
          });
        }
      }

      const map = mapRef.current;

      // Limpiar marcadores anteriores
      Object.values(markersRef.current).forEach((m) => m.setMap(null));
      markersRef.current = {};

      const bounds = new google.maps.LatLngBounds();
      let hasCoords = false;

      stores.forEach((store) => {
        const { lat, lng } = store.location;
        if (!lat || !lng) return;

        const isHL = store.slug === highlightedSlug;
        const position = { lat, lng };

        const marker = new google.maps.Marker({
          position,
          map,
          title: store.name,
          icon: {
            url: isHL
              ? "https://maps.google.com/mapfiles/ms/icons/purple-dot.png"
              : "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
            scaledSize: new google.maps.Size(isHL ? 40 : 32, isHL ? 40 : 32),
          },
          zIndex: isHL ? 100 : 1,
          animation: isHL ? google.maps.Animation.BOUNCE : undefined,
        });

        marker.addListener("click", () => {
          onMarkerClick(store.slug);
          infoWindowRef.current?.setContent(
            `<div style="min-width:150px;padding:4px 0">
              <strong style="font-size:13px">${store.name}</strong>
              ${store.store_type ? `<br><span style="color:#7c3aed;font-size:11px">${store.store_type.name}</span>` : ""}
              ${store.rating_avg ? `<br><span style="font-size:12px">⭐ ${store.rating_avg.toFixed(1)} (${store.rating_count})</span>` : ""}
              <br><a href="/tienda/${store.slug}" style="color:#7c3aed;font-size:12px;font-weight:600">Ver tienda →</a>
            </div>`
          );
          infoWindowRef.current?.open(map, marker);
        });

        markersRef.current[store.slug] = marker;
        bounds.extend(position);
        hasCoords = true;
      });

      // Centrar el mapa en los resultados si hay tiendas con coords
      if (hasCoords && stores.length > 1) {
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      }

      // Abrir popup del destacado
      if (highlightedSlug && markersRef.current[highlightedSlug]) {
        const m = markersRef.current[highlightedSlug];
        m.setAnimation(google.maps.Animation.BOUNCE);
        google.maps.event.trigger(m, "click");
      }
    });
  }, [stores, highlightedSlug, userLocation, onMarkerClick]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: "400px" }}
    />
  );
}
