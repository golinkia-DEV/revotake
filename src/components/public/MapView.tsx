"use client";

import { useEffect, useRef } from "react";
import type { StoreCardData } from "./StoreCard";

interface Props {
  stores: StoreCardData[];
  highlightedSlug: string | null;
  onMarkerClick: (slug: string) => void;
  userLocation: { lat: number; lng: number } | null;
}

// Leaflet se carga dinámicamente para evitar errores de SSR
export default function MapView({ stores, highlightedSlug, onMarkerClick, userLocation }: Props) {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    // Importar Leaflet solo en cliente
    import("leaflet").then((L) => {
      // Ícono por defecto corregido (Next.js rompe los paths por defecto)
      const DefaultIcon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const HighlightIcon = L.icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      // Inicializar mapa solo una vez
      if (!mapRef.current) {
        const center: [number, number] = userLocation
          ? [userLocation.lat, userLocation.lng]
          : [-33.4569, -70.6483]; // Santiago por defecto

        mapRef.current = L.map(containerRef.current!, {
          center,
          zoom: 12,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(mapRef.current);

        // Marcador de usuario
        if (userLocation) {
          const userIcon = L.divIcon({
            className: "",
            html: `<div style="width:14px;height:14px;background:#6d28d9;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
            .addTo(mapRef.current)
            .bindPopup("Tu ubicación");
        }
      }

      const map = mapRef.current;

      // Limpiar marcadores anteriores
      Object.values(markersRef.current).forEach((m: any) => m.remove());
      markersRef.current = {};

      // Agregar marcadores de tiendas
      stores.forEach((store) => {
        const { lat, lng } = store.location;
        if (!lat || !lng) return;

        const isHL = store.slug === highlightedSlug;
        const icon = isHL ? HighlightIcon : DefaultIcon;
        const marker = L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="min-width:140px">
              <strong style="font-size:13px">${store.name}</strong>
              ${store.store_type ? `<br><span style="color:#7c3aed;font-size:11px">${store.store_type.name}</span>` : ""}
              ${store.rating_avg ? `<br><span style="font-size:12px">⭐ ${store.rating_avg.toFixed(1)} (${store.rating_count})</span>` : ""}
              <br><a href="/tienda/${store.slug}" style="color:#7c3aed;font-size:12px;font-weight:600">Ver tienda →</a>
            </div>`,
            { maxWidth: 200 }
          );

        marker.on("click", () => onMarkerClick(store.slug));
        markersRef.current[store.slug] = marker;
      });

      // Actualizar ícono del marcador destacado
      if (highlightedSlug && markersRef.current[highlightedSlug]) {
        markersRef.current[highlightedSlug].setIcon(HighlightIcon);
        markersRef.current[highlightedSlug].openPopup();
      }
    });

    // Agregar CSS de Leaflet
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    return () => {
      // No destruir el mapa al re-render para evitar parpadeos
    };
  }, [stores, highlightedSlug, userLocation, onMarkerClick]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: "400px" }}
    />
  );
}
