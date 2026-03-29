"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { getStoreId, setStoreId } from "@/lib/store";
import clsx from "clsx";

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
      <div className="px-3 py-2 text-xs text-amber-400/90 bg-amber-500/10 rounded-xl border border-amber-500/20">
        Crea una tienda para usar el panel.
      </div>
    );
  }

  return (
    <div className="relative px-3 mb-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left bg-dark-700/50 border border-white/5 text-gray-200 hover:bg-white/5 transition-colors"
      >
        <Building2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
        <span className="truncate flex-1">{currentName}</span>
        <ChevronDown className={clsx("w-4 h-4 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="absolute left-3 right-3 top-full mt-1 py-1 rounded-xl bg-dark-700 border border-white/10 shadow-xl z-50 max-h-56 overflow-auto">
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => select(s.id)}
                className={clsx(
                  "w-full text-left px-3 py-2 text-sm hover:bg-white/5",
                  s.id === active ? "text-brand-400" : "text-gray-300"
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
