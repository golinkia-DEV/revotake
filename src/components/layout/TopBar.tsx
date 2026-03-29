"use client";

import { MaterialIcon } from "@/components/ui/MaterialIcon";

type Props = {
  searchPlaceholder?: string;
};

export default function TopBar({ searchPlaceholder = "Buscar operaciones, clientes o inventario..." }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-100 bg-white/80 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
      <div className="relative flex max-w-md flex-1 items-center">
        <MaterialIcon name="search" className="pointer-events-none absolute left-3 text-lg text-slate-400" />
        <input
          type="search"
          className="w-full rounded-full border-none bg-surface-container-low py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20"
          placeholder={searchPlaceholder}
          aria-label="Buscar"
        />
      </div>
      <div className="ml-4 flex items-center gap-2 sm:gap-4">
        <button type="button" className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary" aria-label="Notificaciones">
          <MaterialIcon name="notifications" className="text-xl" />
        </button>
        <button type="button" className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary" aria-label="Ayuda">
          <MaterialIcon name="help" className="text-xl" />
        </button>
        <div className="hidden h-8 w-px bg-slate-200 sm:block" />
        <div className="hidden items-center gap-2 pl-1 sm:flex">
          <span className="text-sm font-semibold text-on-surface">RevoTake</span>
          <div className="h-9 w-9 rounded-full border-2 border-primary/10 bg-primary-fixed/40 ring-2 ring-primary/5" />
        </div>
      </div>
    </header>
  );
}
