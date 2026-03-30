"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Sparkles, Save, ToggleLeft, ToggleRight, Info } from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { getStoreId } from "@/lib/store";

const PLACEHOLDER = `Ejemplo:
Somos una clínica de estética ubicada en Santiago, Chile.

Servicios y precios:
- Limpieza facial: $25.000
- Masaje relajante 60 min: $35.000
- Depilación láser: desde $40.000

Horarios de atención:
- Lunes a viernes: 9:00 a 19:00
- Sábados: 10:00 a 15:00

Políticas:
- Cancelación con 24 horas de anticipación sin costo.
- Se requiere depósito del 50% para reservar.

Formas de pago: efectivo, tarjeta de débito/crédito y transferencia.
WhatsApp: +56 9 1234 5678`;

export default function SettingsPage() {
  const qc = useQueryClient();
  const storeId = getStoreId();

  const { data: storeData } = useQuery({
    queryKey: ["store", storeId],
    queryFn: () => api.get(`/stores/${storeId}`).then((r) => r.data),
    enabled: !!storeId,
  });

  const [context, setContext] = useState("");
  const [strictMode, setStrictMode] = useState(false);

  useEffect(() => {
    const ai = storeData?.settings?.ai || {};
    setContext(ai.business_context || "");
    setStrictMode(!!ai.strict_mode);
  }, [storeData]);

  const save = useMutation({
    mutationFn: () => api.post("/ai/context", { business_context: context, strict_mode: strictMode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store", storeId] });
      toast.success("Contexto guardado. La IA ya usa esta información.");
    },
    onError: () => toast.error("Error al guardar"),
  });

  const charCount = context.length;
  const charLimit = 8000;

  return (
    <AppLayout>
      <div className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Configuración</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Configuración IA</h1>
        <p className="mt-1 text-slate-500">Define qué sabe la IA sobre tu negocio.</p>
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
        {/* Contexto */}
        <motion.div id="ai-context" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tertiary/10 text-tertiary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-on-surface">Contexto del negocio</h2>
              <p className="text-sm text-slate-500">
                Escribe aquí toda la información de tu tienda: servicios, precios, horarios, políticas, ubicación, formas de pago.
                La IA usará exclusivamente este texto para responder a tus clientes.
              </p>
            </div>
          </div>

          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value.slice(0, charLimit))}
            rows={14}
            placeholder={PLACEHOLDER}
            className="input-field w-full resize-none font-mono text-sm"
          />
          <div className={`mt-1 text-right text-xs ${charCount > charLimit * 0.9 ? "text-amber-600" : "text-slate-400"}`}>
            {charCount.toLocaleString()} / {charLimit.toLocaleString()} caracteres
          </div>
        </motion.div>

        {/* Modo estricto */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-on-surface">Modo estricto</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Actívalo para que la IA <strong>solo responda sobre tu negocio</strong> usando el contexto anterior.
                  Si no sabe algo, dirá que no tiene esa información en lugar de inventar.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setStrictMode((v) => !v)} className="ml-4 shrink-0">
              {strictMode
                ? <ToggleRight className="h-8 w-8 text-primary" />
                : <ToggleLeft className="h-8 w-8 text-slate-400" />
              }
            </button>
          </div>
          {strictMode && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              ⚠️ Modo estricto activado. La IA responderá: «No tengo esa información» si se le pregunta algo fuera del contexto configurado.
            </div>
          )}
        </motion.div>

        {/* Guardar */}
        <div className="flex justify-end">
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="btn-primary gap-2"
          >
            <Save className="h-4 w-4" />
            {save.isPending ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>

        {/* Info */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <p className="mb-2 font-semibold text-slate-700 dark:text-slate-300">¿Cómo funciona?</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>El contexto que escribas aquí se envía a la IA en cada conversación.</li>
            <li>Incluye servicios, precios, horarios, políticas y cualquier información que tus clientes puedan preguntar.</li>
            <li>Con modo estricto, la IA no inventará información. Solo responderá sobre lo que hayas escrito.</li>
            <li>Puedes actualizar este contexto en cualquier momento.</li>
            <li>El <strong>Asistente IA</strong> en el menú lateral usa este contexto para responder sobre tu negocio.</li>
            <li>El botón <strong>?</strong> flotante (esquina inferior derecha) es ayuda sobre cómo usar RevoTake, no sobre tu negocio.</li>
          </ul>
        </motion.div>
      </div>
    </AppLayout>
  );
}
