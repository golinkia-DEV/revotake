"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { getStoreId } from "@/lib/store";
import PageSectionMenu from "@/components/ui/PageSectionMenu";
import { StoreSettingsEditor, type SettingsEditorTab } from "@/components/settings/StoreSettingsEditor";

export default function SettingsPage() {
  const storeId = getStoreId();
  const [activeSection, setActiveSection] = useState<SettingsEditorTab>("tienda");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#ai-context") setActiveSection("contexto");
  }, []);

  return (
    <AppLayout>
      <div className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Configuración</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Tu tienda</h1>
        <p className="mt-1 text-slate-500">
          Editá los mismos datos que al registrar el local: ficha pública, operaciones, agenda e inteligencia artificial.
        </p>
      </div>

      {!storeId ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Seleccioná una tienda activa (desde Tiendas o el selector de contexto) para configurarla.
        </p>
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          <PageSectionMenu
            title="Menú de configuración"
            items={[
              { id: "tienda", label: "Datos de la tienda" },
              { id: "contexto", label: "Contexto IA" },
              { id: "modo", label: "Modo estricto" },
              { id: "ayuda", label: "Cómo funciona" },
            ]}
            activeId={activeSection}
            onChange={(id) => setActiveSection(id as SettingsEditorTab)}
          />

          <StoreSettingsEditor storeId={storeId} activeTab={activeSection} />
        </div>
      )}
    </AppLayout>
  );
}
