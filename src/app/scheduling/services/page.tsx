"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  ImageIcon,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Plus,
  Search,
  ExternalLink,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
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

type VisibilityFilter = "all" | "active" | "inactive";
type ViewMode = "lista" | "tarjetas";

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

function mergeServerOrder(items: ServiceRow[], prev: Record<string, string[]>): Record<string, string[]> {
  const byCat = new Map<string, ServiceRow[]>();
  for (const s of items) {
    const k = categoryKey(s.category);
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k)!.push(s);
  }
  const out: Record<string, string[]> = {};
  for (const [k, rows] of byCat) {
    const ids = rows.map((r) => r.id);
    const sortByOrder = (a: string, b: string) => {
      const sa = rows.find((x) => x.id === a)!;
      const sb = rows.find((x) => x.id === b)!;
      return sa.menu_sort_order - sb.menu_sort_order || sa.name.localeCompare(sb.name, "es");
    };
    const prevIds = prev[k]?.filter((id) => ids.includes(id)) ?? [];
    const missing = ids.filter((id) => !prevIds.includes(id)).sort(sortByOrder);
    out[k] = [...prevIds, ...missing];
  }
  return out;
}

function computeMenuSortForSave(
  isEdit: boolean,
  initial: ServiceRow | null,
  categoryTrim: string,
  orderMap: Record<string, string[]>
): number {
  const ck = categoryKey(categoryTrim || null);
  const ids = orderMap[ck] ?? [];
  if (isEdit && initial) {
    const i = ids.indexOf(initial.id);
    if (i >= 0) return i;
  }
  return ids.length;
}

function rowMatches(
  s: ServiceRow,
  q: string,
  filterCat: string | "__all__",
  visibility: VisibilityFilter
): boolean {
  if (visibility === "active" && !s.is_active) return false;
  if (visibility === "inactive" && s.is_active) return false;
  if (filterCat !== "__all__") {
    const k = categoryKey(s.category);
    if (filterCat === GENERAL_KEY) {
      if (k !== GENERAL_KEY) return false;
    } else if ((s.category || "").trim() !== filterCat) {
      return false;
    }
  }
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const blob = `${s.name} ${s.description || ""} ${s.category || ""}`.toLowerCase();
  return blob.includes(t);
}

const EXAMPLES =
  "Belleza y bienestar: facial / corporal, coloración, uñas, masajes, depilación, cejas y pestañas. Salud: consultas, kinesiología, odontología. Usá la misma categoría para agrupar en el menú público.";

const NEURO_TIP =
  "Podés arrastrar con el ícono de agarre para ordenar. Ese orden es el que verán tus clientes en la reserva. Servicios inactivos siguen en tu lista pero no se publican.";

function applyDragResult(
  prev: Record<string, string[]>,
  result: DropResult
): { next: Record<string, string[]>; draggableId: string; srcKey: string; dstKey: string } | null {
  const { destination, source, draggableId } = result;
  if (!destination) return null;
  if (destination.droppableId === source.droppableId && destination.index === source.index) return null;

  const srcKey = source.droppableId;
  const dstKey = destination.droppableId;
  const srcList = [...(prev[srcKey] ?? [])];
  const [removed] = srcList.splice(source.index, 1);
  if (!removed) return null;

  const next: Record<string, string[]> = { ...prev };
  if (srcKey === dstKey) {
    srcList.splice(destination.index, 0, removed);
    next[srcKey] = srcList;
  } else {
    next[srcKey] = srcList;
    const dstList = [...(prev[dstKey] ?? [])];
    dstList.splice(destination.index, 0, removed);
    next[dstKey] = dstList;
  }
  return { next, draggableId, srcKey, dstKey };
}

async function persistOrderAfterDrag(
  newMap: Record<string, string[]>,
  draggableId: string,
  srcKey: string,
  dstKey: string,
  storeId: string,
  queryClient: QueryClient
) {
  const headers = { "X-Store-Id": storeId };
  const newCatForMove = dstKey === GENERAL_KEY ? null : dstKey;
  try {
    if (srcKey === dstKey) {
      await Promise.all(
        (newMap[srcKey] ?? []).map((id, index) =>
          api.patch(`/scheduling/services/${id}`, { menu_sort_order: index }, { headers })
        )
      );
    } else {
      await Promise.all([
        ...(newMap[srcKey] ?? []).map((id, index) =>
          api.patch(`/scheduling/services/${id}`, { menu_sort_order: index }, { headers })
        ),
        ...(newMap[dstKey] ?? []).map((id, index) => {
          const body: { menu_sort_order: number; category?: string | null } = { menu_sort_order: index };
          if (id === draggableId) body.category = newCatForMove;
          return api.patch(`/scheduling/services/${id}`, body, { headers });
        }),
      ]);
    }
    toast.success("Orden actualizado");
    queryClient.invalidateQueries({ queryKey: ["scheduling-services"] });
  } catch {
    toast.error("No se pudo guardar el orden");
    queryClient.invalidateQueries({ queryKey: ["scheduling-services"] });
  }
}

export default function SchedulingServicesMenuPage() {
  const qc = useQueryClient();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string | "__all__">("__all__");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("tarjetas");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [orderMap, setOrderMap] = useState<Record<string, string[]>>({});
  const orderMapRef = useRef(orderMap);
  orderMapRef.current = orderMap;

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

  const items: ServiceRow[] = useMemo(
    () =>
      (data?.items ?? []).map((s: ServiceRow & { image_urls?: string[] }) => ({
        ...s,
        image_urls: Array.isArray(s.image_urls) ? s.image_urls : [],
      })),
    [data?.items]
  );

  const itemsFingerprint = useMemo(
    () =>
      items
        .map((s) => `${s.id}\0${categoryKey(s.category)}\0${s.menu_sort_order}\0${s.is_active ? 1 : 0}`)
        .sort()
        .join("|"),
    [items]
  );

  useEffect(() => {
    setOrderMap((prev) => mergeServerOrder(items, prev));
  }, [itemsFingerprint]);

  const itemById = useMemo(() => new Map(items.map((s) => [s.id, s])), [items]);

  const categoryChips = useMemo(() => {
    const set = new Set<string>();
    for (const s of items) {
      const k = categoryKey(s.category);
      if (k !== GENERAL_KEY) set.add(s.category!.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [items]);

  const categoryKeysOrdered = useMemo(() => {
    const set = new Set<string>();
    for (const s of items) set.add(categoryKey(s.category));
    return Array.from(set).sort((a, b) => {
      if (a === GENERAL_KEY) return -1;
      if (b === GENERAL_KEY) return 1;
      return a.localeCompare(b, "es");
    });
  }, [items]);

  const canReorder = !search.trim() && visibility === "all";

  const visibleCategoryKeys = useMemo(() => {
    return categoryKeysOrdered.filter((key) => {
      const ids = orderMap[key] ?? [];
      return ids.some((id) => {
        const s = itemById.get(id);
        return s && rowMatches(s, search, filterCat, visibility);
      });
    });
  }, [categoryKeysOrdered, orderMap, itemById, search, filterCat, visibility]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!storeId || !canReorder) return;
      const applied = applyDragResult(orderMapRef.current, result);
      if (!applied) return;
      const { next, draggableId, srcKey, dstKey } = applied;
      orderMapRef.current = next;
      setOrderMap(next);
      void persistOrderAfterDrag(next, draggableId, srcKey, dstKey, storeId, qc);
    },
    [storeId, canReorder, qc]
  );

  const toggleCat = (key: string) => {
    setOpenCats((o) => ({ ...o, [key]: o[key] === false ? true : false }));
  };

  const isOpen = (key: string) => openCats[key] !== false;

  const publicBookUrl =
    typeof window !== "undefined" && slug ? `${window.location.origin}/book/${slug}` : slug ? `/book/${slug}` : "";

  const inactiveCount = useMemo(() => items.filter((s) => !s.is_active).length, [items]);

  const panelOpen = !!(showForm || editing);

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Agenda · Catálogo
          </p>
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-on-surface">Menú de servicios</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Organizá tu oferta con claridad: categorías, fotos, precios y el orden en la reserva pública. Interfaz pensada
            para leer rápido y actuar con pocos pasos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {publicBookUrl && (
            <a
              href={publicBookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden /> Ver reserva pública
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden /> Nuevo servicio
          </button>
        </div>
      </div>

      <div
        className="mb-4 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-slate-700 dark:from-slate-900/80 dark:to-slate-900/40"
        role="note"
      >
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          <MaterialIcon name="touch_app" className="mr-1.5 inline text-lg align-text-bottom text-blue-600 dark:text-blue-400" />
          {NEURO_TIP}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          <MaterialIcon name="tips_and_updates" className="mr-1 inline text-base align-text-bottom" />
          {EXAMPLES}
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o descripción…"
            aria-label="Buscar servicios"
            className="input-field min-h-[44px] w-full pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Vista del catálogo">
          <span className="sr-only">Modo de vista</span>
          <button
            type="button"
            onClick={() => setViewMode("tarjetas")}
            className={clsx(
              "inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
              viewMode === "tarjetas"
                ? "bg-blue-600 text-white shadow-md"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            )}
            aria-pressed={viewMode === "tarjetas"}
          >
            <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden /> Tarjetas
          </button>
          <button
            type="button"
            onClick={() => setViewMode("lista")}
            className={clsx(
              "inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
              viewMode === "lista"
                ? "bg-blue-600 text-white shadow-md"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            )}
            aria-pressed={viewMode === "lista"}
          >
            <List className="h-4 w-4 shrink-0" aria-hidden /> Lista
          </button>
        </div>
      </div>

      <div className="mb-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Qué mostrar
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado en reserva pública">
          {(
            [
              { id: "active" as const, label: "Solo activos", hint: "Visibles al reservar" },
              { id: "inactive" as const, label: "Inactivos / archivo", hint: "No publicados · historial" },
              { id: "all" as const, label: "Todos", hint: "Para reordenar arrastrá en esta vista" },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVisibility(v.id)}
              title={v.hint}
              className={clsx(
                "min-h-[44px] rounded-full border px-4 py-2 text-left text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
                visibility === v.id
                  ? "border-blue-600 bg-blue-600 text-white shadow-md"
                  : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              )}
              aria-pressed={visibility === v.id}
            >
              {v.label}
              {v.id === "inactive" && inactiveCount > 0 ? (
                <span className="ml-2 inline-flex min-w-[1.25rem] justify-center rounded-full bg-slate-200 px-1.5 text-xs font-bold text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                  {inactiveCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {!canReorder && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Elegí <strong className="font-semibold text-slate-700 dark:text-slate-300">Todos</strong> y dejá la búsqueda vacía
            para mover servicios entre categorías o cambiar el orden con el mouse.
          </p>
        )}
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setFilterCat("__all__")}
          className={clsx(
            "shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
            filterCat === "__all__"
              ? "bg-slate-800 text-white shadow-md dark:bg-slate-200 dark:text-slate-900"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
          )}
        >
          Todas las categorías
        </button>
        {items.some((s) => !((s.category || "").trim())) && (
          <button
            type="button"
            onClick={() => setFilterCat(GENERAL_KEY)}
            className={clsx(
              "shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
              filterCat === GENERAL_KEY
                ? "bg-slate-800 text-white shadow-md dark:bg-slate-200 dark:text-slate-900"
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
              "shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
              filterCat === c
                ? "bg-slate-800 text-white shadow-md dark:bg-slate-200 dark:text-slate-900"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-label="Cargando" />
        </div>
      )}

      {!isLoading && visibleCategoryKeys.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-600 dark:text-slate-400">
          No hay servicios con estos filtros. Creá uno nuevo, probá otra categoría o revisá los inactivos en{" "}
          <strong className="font-semibold">Inactivos / archivo</strong>.
        </p>
      )}

      {!panelOpen && canReorder ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="space-y-4">
            {visibleCategoryKeys.map((key) => (
              <CategorySection
                key={key}
                catKey={key}
                title={categoryTitle(key)}
                orderedIds={orderMap[key] ?? []}
                itemById={itemById}
                search={search}
                filterCat={filterCat}
                visibility={visibility}
                isOpen={isOpen(key)}
                onToggle={() => toggleCat(key)}
                viewMode={viewMode}
                canReorder
                onEdit={(s) => {
                  setShowForm(false);
                  setEditing(s);
                }}
              />
            ))}
          </div>
        </DragDropContext>
      ) : (
        <div className="space-y-4">
          {visibleCategoryKeys.map((key) => (
            <CategorySection
              key={key}
              catKey={key}
              title={categoryTitle(key)}
              orderedIds={orderMap[key] ?? []}
              itemById={itemById}
              search={search}
              filterCat={filterCat}
              visibility={visibility}
              isOpen={isOpen(key)}
              onToggle={() => toggleCat(key)}
              viewMode={viewMode}
              canReorder={false}
              onEdit={(s) => {
                setShowForm(false);
                setEditing(s);
              }}
            />
          ))}
        </div>
      )}

      <p className="mt-10 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Los profesionales se vinculan a cada servicio vía API{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-slate-800">
          POST /scheduling/professional-services
        </code>
        .
      </p>

      <AnimatePresence>
        {panelOpen && storeId && (
          <ServiceEditorPanel
            key="editor"
            initial={editing}
            creating={showForm && !editing}
            storeId={storeId}
            queryClient={qc}
            categoryKeysOrdered={categoryKeysOrdered}
            orderMap={orderMap}
            itemById={itemById}
            onDragEnd={onDragEnd}
            onClose={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSelectService={(s) => {
              setShowForm(false);
              setEditing(s);
            }}
            onNew={() => {
              setEditing(null);
              setShowForm(true);
            }}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

function CategorySection({
  catKey,
  title,
  orderedIds,
  itemById,
  search,
  filterCat,
  visibility,
  isOpen,
  onToggle,
  viewMode,
  canReorder,
  onEdit,
}: {
  catKey: string;
  title: string;
  orderedIds: string[];
  itemById: Map<string, ServiceRow>;
  search: string;
  filterCat: string | "__all__";
  visibility: VisibilityFilter;
  isOpen: boolean;
  onToggle: () => void;
  viewMode: ViewMode;
  canReorder: boolean;
  onEdit: (s: ServiceRow) => void;
}) {
  const rowsFull = useMemo(
    () => orderedIds.map((id) => itemById.get(id)).filter(Boolean) as ServiceRow[],
    [orderedIds, itemById]
  );

  const rowsDisplayed = useMemo(
    () => rowsFull.filter((s) => rowMatches(s, search, filterCat, visibility)),
    [rowsFull, search, filterCat, visibility]
  );

  const countLabel = rowsDisplayed.length === 1 ? "ítem" : "ítems";

  return (
    <motion.div
      layout
      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 dark:hover:bg-slate-800/80"
        aria-expanded={isOpen}
      >
        <span className="text-base font-bold text-on-surface">{title}</span>
        <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          {rowsDisplayed.length} {countLabel}
          {isOpen ? <ChevronDown className="h-5 w-5 shrink-0" aria-hidden /> : <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100 dark:border-slate-800"
          >
            {canReorder ? (
              <Droppable droppableId={catKey}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={clsx(
                      "p-3 transition-colors",
                      viewMode === "tarjetas" && "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
                      viewMode === "lista" && "space-y-2",
                      snapshot.isDraggingOver && "rounded-xl bg-blue-50/80 ring-2 ring-blue-200/80 dark:bg-blue-950/30 dark:ring-blue-800/60"
                    )}
                  >
                    {rowsFull.map((s, index) => (
                      <ServiceDraggableCard
                        key={s.id}
                        service={s}
                        index={index}
                        viewMode={viewMode}
                        onEdit={() => onEdit(s)}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ) : viewMode === "tarjetas" ? (
              <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
                {rowsDisplayed.map((s) => (
                  <ServiceStaticCard key={s.id} service={s} onEdit={() => onEdit(s)} />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 p-2 dark:divide-slate-800">
                {rowsDisplayed.map((s) => (
                  <li key={s.id}>
                    <ServiceStaticRow service={s} onEdit={() => onEdit(s)} />
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ServiceDraggableCard({
  service: s,
  index,
  viewMode,
  onEdit,
}: {
  service: ServiceRow;
  index: number;
  viewMode: ViewMode;
  onEdit: () => void;
}) {
  return (
    <Draggable draggableId={s.id} index={index}>
      {(provided, snapshot) =>
        viewMode === "tarjetas" ? (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={clsx(
              "flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50/50 p-3 shadow-sm transition dark:border-slate-700 dark:bg-slate-950/50",
              snapshot.isDragging && "z-20 rotate-1 scale-[1.02] border-blue-300 shadow-xl ring-2 ring-blue-400/40 dark:border-blue-700",
              !s.is_active && "opacity-80 ring-1 ring-amber-200/80 dark:ring-amber-900/50"
            )}
          >
            <div className="mb-2 flex items-start gap-2">
              <button
                type="button"
                {...provided.dragHandleProps}
                className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
                aria-label={`Arrastrar para reordenar: ${s.name}`}
              >
                <GripVertical className="h-5 w-5" aria-hidden />
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug text-on-surface">{s.name}</p>
                {!s.is_active && (
                  <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                    Inactivo · no en reserva pública
                  </span>
                )}
              </div>
            </div>
            {s.image_urls?.[0] && (
              <img
                src={fileUrl(s.image_urls[0])}
                alt=""
                className="mb-2 h-28 w-full rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
              />
            )}
            {s.description && <p className="mb-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">{s.description}</p>}
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {s.duration_minutes} min · pos. {index + 1}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-blue-700 dark:text-blue-400">{formatPrice(s.price_cents, s.currency)}</span>
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label={`Editar ${s.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={clsx(
              "flex flex-col gap-2 rounded-xl border border-slate-100 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/40",
              snapshot.isDragging && "z-20 border-blue-300 shadow-lg ring-2 ring-blue-400/30 dark:border-blue-700",
              !s.is_active && "bg-amber-50/50 dark:bg-amber-950/20"
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <button
                type="button"
                {...provided.dragHandleProps}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-600 dark:hover:bg-slate-800"
                aria-label={`Arrastrar para reordenar: ${s.name}`}
              >
                <GripVertical className="h-5 w-5" aria-hidden />
              </button>
              {s.image_urls?.[0] && (
                <img
                  src={fileUrl(s.image_urls[0])}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-on-surface">{s.name}</p>
                {s.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{s.description}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  {s.duration_minutes} min · pos. {index + 1}
                  {!s.is_active ? " · inactivo" : ""}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 pl-14 sm:pl-0">
              <span className="text-sm font-bold text-blue-700 dark:text-blue-400">{formatPrice(s.price_cents, s.currency)}</span>
              <button
                type="button"
                onClick={onEdit}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800"
                aria-label={`Editar ${s.name}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
      }
    </Draggable>
  );
}

function ServiceStaticCard({ service: s, onEdit }: { service: ServiceRow; onEdit: () => void }) {
  return (
    <div
      className={clsx(
        "flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50/50 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/50",
        !s.is_active && "opacity-90 ring-1 ring-amber-200/80 dark:ring-amber-900/50"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-semibold leading-snug text-on-surface">{s.name}</p>
        <button
          type="button"
          onClick={onEdit}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800"
          aria-label={`Editar ${s.name}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      {!s.is_active && (
        <span className="mb-2 inline-block w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Inactivo · archivo
        </span>
      )}
      {s.image_urls?.[0] && (
        <img
          src={fileUrl(s.image_urls[0])}
          alt=""
          className="mb-2 h-28 w-full rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
        />
      )}
      {s.description && <p className="mb-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">{s.description}</p>}
      <div className="mt-auto border-t border-slate-200/80 pt-2 dark:border-slate-700">
        <p className="text-xs text-slate-500">
          {s.duration_minutes} min · orden {s.menu_sort_order}
        </p>
        <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{formatPrice(s.price_cents, s.currency)}</p>
      </div>
    </div>
  );
}

function ServiceStaticRow({ service: s, onEdit }: { service: ServiceRow; onEdit: () => void }) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
        !s.is_active && "bg-amber-50/40 dark:bg-amber-950/15"
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
            <p className="font-semibold text-on-surface">{s.name}</p>
            {s.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{s.description}</p>}
            <p className="mt-1 text-xs text-slate-500">
              {s.duration_minutes} min · orden {s.menu_sort_order}
              {!s.is_active ? " · inactivo (archivo)" : ""}
            </p>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-bold text-blue-700 dark:text-blue-400">{formatPrice(s.price_cents, s.currency)}</span>
        <button
          type="button"
          onClick={onEdit}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800"
          aria-label={`Editar ${s.name}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function DockServiceRow({
  service: s,
  index,
  selected,
  onPick,
}: {
  service: ServiceRow;
  index: number;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <Draggable draggableId={s.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={clsx(
            "mb-1 flex items-stretch gap-0.5 rounded-xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80",
            selected && "border-blue-500 ring-2 ring-blue-500/40",
            snapshot.isDragging && "border-blue-400 shadow-lg dark:border-blue-600",
            !s.is_active && "opacity-75"
          )}
        >
          <button
            type="button"
            {...provided.dragHandleProps}
            className="flex w-10 shrink-0 items-center justify-center rounded-l-xl border-r border-slate-100 text-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            aria-label={`Reordenar: ${s.name}`}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onPick}
            className="min-w-0 flex-1 px-2 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <p className="truncate text-sm font-semibold text-on-surface">{s.name}</p>
            <p className="truncate text-xs text-slate-500">
              {formatPrice(s.price_cents, s.currency)} · {s.duration_minutes} min
              {!s.is_active ? " · inactivo" : ""}
            </p>
          </button>
        </div>
      )}
    </Draggable>
  );
}

function ServiceEditorPanel({
  initial,
  creating,
  storeId,
  queryClient,
  categoryKeysOrdered,
  orderMap,
  itemById,
  onDragEnd,
  onClose,
  onSelectService,
  onNew,
}: {
  initial: ServiceRow | null;
  creating: boolean;
  storeId: string;
  queryClient: QueryClient;
  categoryKeysOrdered: string[];
  orderMap: Record<string, string[]>;
  itemById: Map<string, ServiceRow>;
  onDragEnd: (result: DropResult) => void;
  onClose: () => void;
  onSelectService: (s: ServiceRow) => void;
  onNew: () => void;
}) {
  const [dockSearch, setDockSearch] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [pricePesos, setPricePesos] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const isEdit = !!initial && !creating;

  useEffect(() => {
    if (initial && !creating) {
      setName(initial.name);
      setCategory(initial.category ?? "");
      setDescription(initial.description ?? "");
      setDuration(initial.duration_minutes);
      setPricePesos(Math.round(initial.price_cents / 100));
      setIsActive(initial.is_active);
      setImageUrls(Array.isArray(initial.image_urls) ? initial.image_urls : []);
      setPendingFiles([]);
    } else {
      setName("");
      setCategory("");
      setDescription("");
      setDuration(30);
      setPricePesos(0);
      setIsActive(true);
      setImageUrls([]);
      setPendingFiles([]);
    }
  }, [initial?.id, creating]);

  const dockKeys = useMemo(() => {
    const q = dockSearch.trim().toLowerCase();
    if (!q) return categoryKeysOrdered;
    return categoryKeysOrdered.filter((key) => {
      const ids = orderMap[key] ?? [];
      return ids.some((id) => {
        const s = itemById.get(id);
        return s && `${s.name} ${s.category ?? ""}`.toLowerCase().includes(q);
      });
    });
  }, [categoryKeysOrdered, orderMap, itemById, dockSearch]);

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

  async function suggestDescriptionWithAi() {
    if (!name.trim()) {
      toast.error("Escribí el nombre del servicio antes de generar la descripción");
      return;
    }
    setAiLoading(true);
    try {
      const r = await api.post("/scheduling/services/suggest-description", {
        name: name.trim(),
        category: category.trim() || null,
        duration_minutes: duration,
        price_cents: Math.max(0, Math.round(Number(pricePesos) * 100)),
        currency: "CLP",
      });
      const text = (r.data?.description as string | undefined)?.trim();
      if (text) {
        setDescription(text);
        toast.success("Descripción sugerida por IA");
      } else {
        toast.error("La IA no devolvió texto");
      }
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "No se pudo generar (¿IA configurada y permisos de admin?)");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const price_cents = Math.max(0, Math.round(Number(pricePesos) * 100));
    const headers = { "X-Store-Id": storeId };
    const menu_sort_order = computeMenuSortForSave(isEdit, initial, category, orderMap);
    setSaving(true);
    try {
      if (isEdit && initial) {
        await api.patch(
          `/scheduling/services/${initial.id}`,
          {
            name: name.trim(),
            category: category.trim() || null,
            menu_sort_order,
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
            menu_sort_order,
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
      className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: 48, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 48, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex h-full min-h-0 flex-col lg:flex-row">
          <aside className="flex max-h-[42vh] shrink-0 flex-col border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 lg:max-h-none lg:w-[min(100%,320px)] lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 dark:border-slate-800">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Catálogo</p>
                <p className="text-sm font-semibold text-on-surface">Todos los servicios</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-slate-200 p-2 dark:border-slate-800">
              <button
                type="button"
                onClick={onNew}
                className={clsx(
                  "mb-2 w-full rounded-xl border-2 border-dashed px-3 py-2.5 text-sm font-semibold transition",
                  creating
                    ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-100"
                    : "border-slate-300 text-slate-700 hover:border-blue-400 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-900"
                )}
              >
                <Plus className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden /> Nuevo servicio
              </button>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={dockSearch}
                  onChange={(e) => setDockSearch(e.target.value)}
                  placeholder="Buscar en la lista…"
                  className="input-field w-full py-2 pl-8 text-sm"
                  aria-label="Buscar servicio en el panel"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <DragDropContext onDragEnd={onDragEnd}>
                <div className="space-y-3">
                  {dockKeys.map((key) => {
                    const orderedIds = orderMap[key] ?? [];
                    const rows = orderedIds.map((id) => itemById.get(id)).filter(Boolean) as ServiceRow[];
                    if (rows.length === 0) return null;
                    return (
                      <div key={key}>
                        <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          {categoryTitle(key)}
                        </p>
                        <Droppable droppableId={key}>
                          {(provided, snap) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={clsx(
                                "rounded-xl p-1 transition-colors",
                                snap.isDraggingOver && "bg-blue-50/90 dark:bg-blue-950/40"
                              )}
                            >
                              {rows.map((s, index) => (
                                <DockServiceRow
                                  key={s.id}
                                  service={s}
                                  index={index}
                                  selected={!creating && initial?.id === s.id}
                                  onPick={() => onSelectService(s)}
                                />
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    );
                  })}
                </div>
              </DragDropContext>
            </div>
            <p className="border-t border-slate-200 px-3 py-2 text-[10px] leading-snug text-slate-500 dark:border-slate-800">
              Arrastrá con ⋮⋮ para ordenar o cambiar de categoría soltando en otra sección.
            </p>
          </aside>

          <main className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
              <h2 className="text-xl font-bold text-on-surface">{isEdit ? "Editar servicio" : "Nuevo servicio"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isEdit ? "Cambios locales hasta que guardés." : "Completá los datos y guardá para publicarlo."}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
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
          <p className="text-[11px] text-slate-500">Mismo texto = misma sección que en la columna izquierda.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </div>
          <p className="text-[11px] text-slate-500">
            El orden en el menú lo definís arrastrando filas en la columna izquierda (misma categoría o entre categorías).
          </p>
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Descripción breve</label>
              <button
                type="button"
                onClick={() => void suggestDescriptionWithAi()}
                disabled={aiLoading || saving || !name.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-100 dark:hover:bg-violet-900/60"
              >
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
                Generar con IA
              </button>
            </div>
            <textarea
              className="input-field min-h-[100px] w-full resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Texto que verán en la reserva pública (opcional). Usá «Generar con IA» como punto de partida."
            />
            <p className="mt-1 text-[11px] text-slate-500">
              La IA usa nombre, categoría, duración, precio y el contexto de tu tienda (Configuración → IA). Revisá siempre el texto antes de publicar.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <ImageIcon className="h-4 w-4 shrink-0" /> Fotos (máx. 5 · JPG, PNG o WebP)
            </p>
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((u) => (
                <div key={u} className="relative h-16 w-16 shrink-0">
                  <img
                    src={fileUrl(u)}
                    alt=""
                    className="h-full w-full rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-600"
                  />
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
              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/80">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEdit ? "Guardar cambios" : "Crear servicio"}
                </button>
              </div>
            </form>
          </main>
        </div>
      </motion.div>
    </motion.div>
  );
}
