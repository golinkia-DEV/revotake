"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Search,
  ExternalLink,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import clsx from "clsx";
import { getStoreId } from "@/lib/store";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { fileUrl } from "@/lib/files";

type ServiceRow = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  menu_sort_order: number;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  currency: string;
  is_active: boolean;
  image_urls: string[];
};

const GENERAL_KEY = "__general__";

function categoryKey(c: string | null | undefined) {
  const t = (c || "").trim();
  return t ? t : GENERAL_KEY;
}

function categoryTitle(key: string) {
  return key === GENERAL_KEY ? "General" : key;
}

function formatPrice(cents: number, currency: string) {
  if (cents === 0) return "Gratis";
  return `${(cents / 100).toLocaleString("es-CL")} ${currency}`;
}

const EXAMPLES =
  "Belleza y bienestar: facial / corporal, coloración, uñas, masajes, depilación, cejas y pestañas. Salud: consultas, kinesiología, odontología. Usá la misma categoría para agrupar en el menú público.";

export default function SchedulingServicesMenuPage() {
  const qc = useQueryClient();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string | "__all__">("__all__");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: () => api.get("/stores/").then((r) => r.data),
  });
  const slug = stores?.items?.find((s: { id: string }) => s.id === storeId)?.slug as string | undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["scheduling-services", storeId],
    queryFn: () => api.get("/scheduling/services").then((r) => r.data),
    enabled: !!storeId,
  });

  const items: ServiceRow[] = (data?.items ?? []).map((s: ServiceRow & { image_urls?: string[] }) => ({
    ...s,
    image_urls: Array.isArray(s.image_urls) ? s.image_urls : [],
  }));

  const categoryChips = useMemo(() => {
    const set = new Set<string>();
    for (const s of items) {
      const k = categoryKey(s.category);
      if (k !== GENERAL_KEY) set.add(s.category!.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      if (filterCat !== "__all__") {
        const k = categoryKey(s.category);
        if (filterCat === GENERAL_KEY) {
          if (k !== GENERAL_KEY) return false;
        } else if ((s.category || "").trim() !== filterCat) {
          return false;
        }
      }
      if (!q) return true;
      const blob = `${s.name} ${s.description || ""} ${s.category || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [items, search, filterCat]);

  const grouped = useMemo(() => {
    const m = new Map<string, ServiceRow[]>();
    for (const s of filtered) {
      const k = categoryKey(s.category);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    const keys = Array.from(m.keys()).sort((a, b) => {
      if (a === GENERAL_KEY) return -1;
      if (b === GENERAL_KEY) return 1;
      return a.localeCompare(b, "es");
    });
    return keys.map((k) => ({ key: k, title: categoryTitle(k), rows: m.get(k)! }));
  }, [filtered]);

  const toggleCat = (key: string) => {
    setOpenCats((o) => ({ ...o, [key]: o[key] === false ? true : false }));
  };

  const isOpen = (key: string) => openCats[key] !== false;

  const publicBookUrl =
    typeof window !== "undefined" && slug ? `${window.location.origin}/book/${slug}` : slug ? `/book/${slug}` : "";

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-on-surface">Menú de servicios</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            Catálogo para salones, clínicas, spa y citas de bienestar: categorías, fotos (hasta 5 por servicio), precios y
            orden. El logotipo del local se sube en Tiendas → Configuración. Solo servicios activos en la reserva pública.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {publicBookUrl && (
            <a
              href={publicBookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <ExternalLink className="h-4 w-4" /> Ver reserva pública
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25"
          >
            <Plus className="h-4 w-4" /> Nuevo servicio
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          <MaterialIcon name="tips_and_updates" className="mr-1 inline text-base align-text-bottom" />
          {EXAMPLES}
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="¿Qué servicio buscás?"
            className="input-field w-full pl-10"
          />
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setFilterCat("__all__")}
          className={clsx(
            "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
            filterCat === "__all__"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
          )}
        >
          Todos
        </button>
        {items.some((s) => !((s.category || "").trim())) && (
          <button
            type="button"
            onClick={() => setFilterCat(GENERAL_KEY)}
            className={clsx(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
              filterCat === GENERAL_KEY
                ? "bg-blue-600 text-white shadow-md"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            )}
          >
            General
          </button>
        )}
        {categoryChips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilterCat(c)}
            className={clsx(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
              filterCat === c
                ? "bg-blue-600 text-white shadow-md"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {!isLoading && grouped.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-500">
          No hay servicios con estos filtros. Creá el primero o ajustá la búsqueda.
        </p>
      )}

      <div className="space-y-3">
        {grouped.map(({ key, title, rows }) => (
          <motion.div
            key={key}
            layout
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
          >
            <button
              type="button"
              onClick={() => toggleCat(key)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
            >
              <span className="font-semibold text-on-surface">{title}</span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                {rows.length} {rows.length === 1 ? "ítem" : "ítems"}
                {isOpen(key) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen(key) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows.map((s) => (
                      <li
                        key={s.id}
                        className={clsx(
                          "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                          !s.is_active && "bg-slate-50/80 opacity-70 dark:bg-slate-950/40"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-3">
                            {s.image_urls?.[0] && (
                              <img
                                src={fileUrl(s.image_urls[0])}
                                alt=""
                                className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                              />
                            )}
                            <div className="min-w-0">
                          <p className="font-medium text-on-surface">{s.name}</p>
                          {s.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{s.description}</p>
                          )}
                          <p className="mt-1 text-xs text-slate-400">
                            {s.duration_minutes} min · orden {s.menu_sort_order}
                            {s.image_urls?.length ? ` · ${s.image_urls.length} foto(s)` : ""}
                            {!s.is_active && " · inactivo (no aparece en la reserva pública)"}
                          </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                            {formatPrice(s.price_cents, s.currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowForm(false);
                              setEditing(s);
                            }}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-slate-500">
        Los profesionales siguen vinculándose a cada servicio vía API{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">POST /scheduling/professional-services</code>.
      </p>

      <AnimatePresence>
        {(showForm || editing) && storeId && (
          <ServiceFormModal
            key={editing?.id ?? "create"}
            initial={editing}
            storeId={storeId}
            queryClient={qc}
            onClose={() => {
              setShowForm(false);
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

function ServiceFormModal({
  initial,
  storeId,
  queryClient,
  onClose,
}: {
  initial: ServiceRow | null;
  storeId: string;
  queryClient: QueryClient;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [menuSort, setMenuSort] = useState(initial?.menu_sort_order ?? 0);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [duration, setDuration] = useState(initial?.duration_minutes ?? 30);
  const [pricePesos, setPricePesos] = useState(
    initial ? Math.round(initial.price_cents / 100) : 0
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [imageUrls, setImageUrls] = useState<string[]>(initial?.image_urls ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isEdit = !!initial;
  const canAddMore = imageUrls.length + pendingFiles.length < 5;

  async function handlePickImages(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;
    if (isEdit && initial?.id) {
      setUploading(true);
      try {
        let urls = [...imageUrls];
        for (const f of picked) {
          if (urls.length >= 5) break;
          const fd = new FormData();
          fd.append("file", f);
          const r = await api.post(`/uploads/service-images/${initial.id}`, fd, {
            headers: { "X-Store-Id": storeId },
          });
          urls = r.data.image_urls as string[];
        }
        setImageUrls(urls);
        queryClient.invalidateQueries({ queryKey: ["scheduling-services"] });
        toast.success("Imagen(es) subida(s)");
      } catch {
        toast.error("No se pudo subir la imagen");
      } finally {
        setUploading(false);
      }
      return;
    }
    const room = 5 - imageUrls.length - pendingFiles.length;
    setPendingFiles((prev) => [...prev, ...picked.slice(0, Math.max(0, room))]);
  }

  async function removeImage(url: string) {
    if (!initial?.id) return;
    try {
      const r = await api.delete(`/uploads/service-images/${initial.id}`, {
        data: { url },
        headers: { "X-Store-Id": storeId },
      });
      setImageUrls(r.data.image_urls as string[]);
      queryClient.invalidateQueries({ queryKey: ["scheduling-services"] });
    } catch {
      toast.error("No se pudo eliminar la imagen");
    }
  }

  function removePending(idx: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const price_cents = Math.max(0, Math.round(Number(pricePesos) * 100));
    const headers = { "X-Store-Id": storeId };
    setSaving(true);
    try {
      if (isEdit && initial) {
        await api.patch(
          `/scheduling/services/${initial.id}`,
          {
            name: name.trim(),
            category: category.trim() || null,
            menu_sort_order: menuSort,
            description: description.trim() || null,
            duration_minutes: duration,
            price_cents,
            is_active: isActive,
          },
          { headers }
        );
        toast.success("Servicio actualizado");
      } else {
        const r = await api.post(
          "/scheduling/services",
          {
            name: name.trim(),
            category: category.trim() || null,
            menu_sort_order: menuSort,
            description: description.trim() || null,
            duration_minutes: duration,
            price_cents,
            currency: "CLP",
          },
          { headers }
        );
        const newId = r.data.id as string;
        for (const f of pendingFiles) {
          const fd = new FormData();
          fd.append("file", f);
          await api.post(`/uploads/service-images/${newId}`, fd, { headers });
        }
        toast.success("Servicio creado");
      }
      queryClient.invalidateQueries({ queryKey: ["scheduling-services"] });
      onClose();
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "No se pudo guardar (¿admin de tienda?)");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <motion.form
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <h2 className="mb-4 text-lg font-bold text-on-surface">{isEdit ? "Editar servicio" : "Nuevo servicio"}</h2>
        <div className="space-y-3">
          <input
            className="input-field w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del servicio *"
            required
          />
          <input
            className="input-field w-full"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoría del menú (opcional)"
          />
          <p className="text-[11px] text-slate-500">Mismo texto = misma sección al agrupar (cualquier negocio).</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Orden en menú</label>
              <input
                type="number"
                className="input-field w-full"
                value={menuSort}
                onChange={(e) => setMenuSort(parseInt(e.target.value, 10) || 0)}
                min={0}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Duración (min)</label>
              <input
                type="number"
                className="input-field w-full"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10) || 30)}
                min={5}
                step={5}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Precio (pesos)</label>
            <input
              type="number"
              className="input-field w-full"
              value={pricePesos}
              onChange={(e) => setPricePesos(parseInt(e.target.value, 10) || 0)}
              min={0}
            />
          </div>
          <textarea
            className="input-field min-h-[80px] w-full resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción breve (opcional)"
          />
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <ImageIcon className="h-4 w-4 shrink-0" /> Fotos (máx. 5 · JPG, PNG o WebP)
            </p>
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((u) => (
                <div key={u} className="relative h-16 w-16 shrink-0">
                  <img src={fileUrl(u)} alt="" className="h-full w-full rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-600" />
                  {isEdit && (
                    <button
                      type="button"
                      onClick={() => removeImage(u)}
                      className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow"
                      aria-label="Quitar foto"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {pendingFiles.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="flex h-16 max-w-[120px] flex-col justify-center rounded-lg bg-slate-100 px-2 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  <span className="line-clamp-2">{f.name}</span>
                  <button type="button" onClick={() => removePending(i)} className="mt-1 text-red-600 hover:underline">
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            {canAddMore ? (
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-blue-600 hover:underline">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={handlePickImages}
                  disabled={uploading || saving}
                />
                {uploading ? "Subiendo…" : isEdit ? "Añadir fotos" : "Elegir fotos (se suben al guardar)"}
              </label>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">Límite de 5 fotos alcanzado.</p>
            )}
          </div>
          {isEdit && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Activo en reserva pública
            </label>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Guardar" : "Crear"}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
