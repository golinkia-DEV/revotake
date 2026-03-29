"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { getStoreId, setStoreId } from "@/lib/store";
import clsx from "clsx";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

interface StoreRow {
  id: string;
  name: string;
}

export default function StoreSwitcher() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["my-stores"],
    queryFn: () => api.get("/stores/").then((r) => r.data),
  });

  useEffect(() => {
    setActive(getStoreId());
  }, []);

  const items = (data?.items as StoreRow[]) || [];
  const currentName = items.find((s) => s.id === active)?.name || "Seleccionar tienda";

  function select(id: string) {
    setStoreId(id);
    setActive(id);
    setOpen(false);
    qc.invalidateQueries();
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Crea una tienda para usar el panel.
      </div>
    );
  }

  return (
    <div className="relative px-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-left text-sm text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700/80"
      >
        <MaterialIcon name="storefront" className="flex-shrink-0 text-primary" />
        <span className="flex-1 truncate">{currentName}</span>
        <ChevronDown className={clsx("h-4 w-4 flex-shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800">
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => select(s.id)}
                className={clsx(
                  "w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/80",
                  s.id === active ? "font-semibold text-primary" : "text-slate-700 dark:text-slate-200"
                )}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
