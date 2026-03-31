"use client";

import clsx from "clsx";

export interface PageSectionMenuItem {
  id: string;
  label: string;
}

interface PageSectionMenuProps {
  title?: string;
  items: PageSectionMenuItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function PageSectionMenu({
  title = "Secciones",
  items,
  activeId,
  onChange,
  className,
}: PageSectionMenuProps) {
  return (
    <div className={clsx("mb-6 rounded-2xl border border-slate-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/50", className)}>
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                active
                  ? "bg-primary text-white shadow-sm shadow-primary/20"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
