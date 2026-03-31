"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Banknote, Smartphone, ChevronDown, ChevronUp,
  Save, Eye, EyeOff, CheckCircle2, AlertCircle, ExternalLink,
  Shield, Zap, Settings2,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { getStoreId } from "@/lib/store";
import { toast } from "sonner";
import clsx from "clsx";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

interface PaymentSettings {
  webpay?: {
    enabled: boolean;
    sandbox: boolean;
    commerce_code: string;
    api_key: string;
    webhook_secret: string;
  };
  mercadopago?: {
    enabled: boolean;
    sandbox: boolean;
    public_key: string;
    access_token: string;
    webhook_secret: string;
    country: string;
  };
  cash?: { enabled: boolean };
  transfer?: {
    enabled: boolean;
    bank_name: string;
    account_type: string;
    account_number: string;
    account_holder: string;
    rut: string;
    email: string;
  };
}

const defaultSettings: PaymentSettings = {
  webpay: { enabled: false, sandbox: true, commerce_code: "", api_key: "", webhook_secret: "" },
  mercadopago: { enabled: false, sandbox: true, public_key: "", access_token: "", webhook_secret: "", country: "CL" },
  cash: { enabled: true },
  transfer: { enabled: false, bank_name: "", account_type: "cuenta_corriente", account_number: "", account_holder: "", rut: "", email: "" },
};

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
        checked ? "bg-primary" : "bg-slate-300 dark:bg-slate-600",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span className={clsx(
        "inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out",
        checked ? "translate-x-5" : "translate-x-0"
      )} />
    </button>
  );
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
        className="input-field pr-10" placeholder={placeholder} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SectionCard({ icon, title, subtitle, badge, enabled, onToggle, sandboxMode, children }: {
  icon: React.ReactNode; title: string; subtitle: string; badge?: string; enabled: boolean;
  onToggle: (v: boolean) => void; sandboxMode?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        "rounded-2xl border transition-all duration-200",
        enabled ? "border-primary/20 bg-white shadow-sm dark:bg-slate-900" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50"
      )}
    >
      <div className="flex items-center gap-4 p-5">
        <div className={clsx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", enabled ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-400 dark:bg-slate-700")}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-on-surface">{title}</h3>
            {badge && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">{badge}</span>}
            {enabled && sandboxMode && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                Sandbox
              </span>
            )}
            {enabled && !sandboxMode && (
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                Producción
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ToggleSwitch checked={enabled} onChange={onToggle} />
          {enabled && (
            <button type="button" onClick={() => setOpen(!open)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
      <AnimatePresence>
        {enabled && open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-slate-200 px-5 pb-5 pt-4 dark:border-slate-700">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PaymentMethodsPage() {
  const qc = useQueryClient();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const [settings, setSettings] = useState<PaymentSettings>(defaultSettings);

  const { data: storeData, isLoading } = useQuery({
    queryKey: ["store", storeId],
    queryFn: () => api.get(`/stores/${storeId}`).then((r) => r.data),
    enabled: !!storeId,
  });

  useEffect(() => {
    if (!storeData?.settings?.payments) return;
    setSettings({ ...defaultSettings, ...storeData.settings.payments });
  }, [storeData]);

  const save = useMutation({
    mutationFn: () => api.patch(`/stores/${storeId}`, { settings: { ...storeData?.settings, payments: settings } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["store", storeId] }); toast.success("Métodos de pago guardados"); },
    onError: () => toast.error("Error al guardar configuración"),
  });

  function setWebpay(patch: Partial<NonNullable<PaymentSettings["webpay"]>>) {
    setSettings((s) => ({ ...s, webpay: { ...defaultSettings.webpay!, ...s.webpay, ...patch } }));
  }
  function setMP(patch: Partial<NonNullable<PaymentSettings["mercadopago"]>>) {
    setSettings((s) => ({ ...s, mercadopago: { ...defaultSettings.mercadopago!, ...s.mercadopago, ...patch } }));
  }
  function setTransfer(patch: Partial<NonNullable<PaymentSettings["transfer"]>>) {
    setSettings((s) => ({ ...s, transfer: { ...defaultSettings.transfer!, ...s.transfer, ...patch } }));
  }

  const wp = { ...defaultSettings.webpay!, ...settings.webpay };
  const mp = { ...defaultSettings.mercadopago!, ...settings.mercadopago };
  const cash = { enabled: settings.cash?.enabled ?? true };
  const transfer = { ...defaultSettings.transfer!, ...settings.transfer };

  const activeCount = [wp.enabled, mp.enabled, cash.enabled, transfer.enabled].filter(Boolean).length;

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">Configuración avanzada</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-on-surface mb-2">Métodos de pago</h1>
        <p className="text-sm text-slate-500">
          Configurá los pasarelas de pago para cobros online en citas y reservas.
          Los pagos en sitio siempre están disponibles.
        </p>
      </div>

      {/* Status summary */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-transparent bg-surface-container-lowest p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-600">Activos</span>
          </div>
          <h3 className="text-2xl font-bold text-on-surface">{activeCount}</h3>
          <p className="text-xs text-slate-500">métodos habilitados</p>
        </div>
        <div className="rounded-2xl border border-transparent bg-surface-container-lowest p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wide text-primary">Online</span>
          </div>
          <h3 className="text-2xl font-bold text-on-surface">{[wp.enabled, mp.enabled].filter(Boolean).length}</h3>
          <p className="text-xs text-slate-500">pasarelas conectadas</p>
        </div>
        <div className="rounded-2xl border border-transparent bg-surface-container-lowest p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wide text-amber-500">Modo</span>
          </div>
          <h3 className="text-base font-bold text-on-surface">{wp.sandbox || mp.sandbox ? "Sandbox" : "Producción"}</h3>
          <p className="text-xs text-slate-500">entorno activo</p>
        </div>
        <div className="rounded-2xl border border-transparent bg-surface-container-lowest p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-slate-500" />
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Webhooks</span>
          </div>
          <h3 className="text-base font-bold text-on-surface">{[wp.enabled && wp.webhook_secret, mp.enabled && mp.webhook_secret].filter(Boolean).length} / {[wp.enabled, mp.enabled].filter(Boolean).length}</h3>
          <p className="text-xs text-slate-500">configurados</p>
        </div>
      </div>

      <div className="space-y-4">

        {/* WebPay Plus */}
        <SectionCard
          icon={<CreditCard className="h-6 w-6" />}
          title="WebPay Plus"
          subtitle="Transbank — Tarjetas de débito y crédito en Chile"
          badge="Chile"
          enabled={wp.enabled}
          onToggle={(v) => setWebpay({ enabled: v })}
          sandboxMode={wp.sandbox}
        >
          <div className="space-y-5">
            {/* Sandbox toggle */}
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Modo de prueba (Sandbox)</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Desactivá para usar en producción con credenciales reales</p>
              </div>
              <ToggleSwitch checked={wp.sandbox} onChange={(v) => setWebpay({ sandbox: v })} />
            </div>

            {!wp.sandbox && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/20">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <p className="text-xs text-red-700 dark:text-red-400">Modo producción activo. Asegurate de usar las credenciales reales de Transbank.</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Código de comercio</label>
                <input value={wp.commerce_code} onChange={(e) => setWebpay({ commerce_code: e.target.value })}
                  className="input-field font-mono" placeholder={wp.sandbox ? "597055555532" : "Tu código real"} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">API Key</label>
                <SecretInput value={wp.api_key} onChange={(v) => setWebpay({ api_key: v })}
                  placeholder={wp.sandbox ? "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C" : "Tu API key real"} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Webhook Secret (para verificar notificaciones)</label>
              <SecretInput value={wp.webhook_secret} onChange={(v) => setWebpay({ webhook_secret: v })} placeholder="Clave secreta para validar webhooks" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              <p className="font-semibold mb-1">URL de retorno (configurar en Transbank)</p>
              <code className="break-all">{typeof window !== "undefined" ? window.location.origin : "https://tu-dominio.com"}/api/webhooks/webpay/return</code>
              <p className="mt-2 font-semibold mb-1">URL de webhook</p>
              <code className="break-all">/webhooks/scheduling/webpay</code>
              <a href="https://www.transbankdevelopers.cl/documentacion/webpay-plus" target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-primary hover:underline">
                Ver documentación Transbank <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </SectionCard>

        {/* MercadoPago */}
        <SectionCard
          icon={<Smartphone className="h-6 w-6" />}
          title="Mercado Pago"
          subtitle="Tarjetas, transferencias y billetera digital"
          badge="LATAM"
          enabled={mp.enabled}
          onToggle={(v) => setMP({ enabled: v })}
          sandboxMode={mp.sandbox}
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Modo de prueba (Sandbox)</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Usá credenciales de prueba de MercadoPago</p>
              </div>
              <ToggleSwitch checked={mp.sandbox} onChange={(v) => setMP({ sandbox: v })} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">País</label>
              <select value={mp.country} onChange={(e) => setMP({ country: e.target.value })} className="input-field">
                <option value="CL">Chile (CLP)</option>
                <option value="AR">Argentina (ARS)</option>
                <option value="CO">Colombia (COP)</option>
                <option value="MX">México (MXN)</option>
                <option value="PE">Perú (PEN)</option>
                <option value="UY">Uruguay (UYU)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Public Key</label>
                <input value={mp.public_key} onChange={(e) => setMP({ public_key: e.target.value })}
                  className="input-field font-mono text-xs" placeholder="APP_USR-..." />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Access Token</label>
                <SecretInput value={mp.access_token} onChange={(v) => setMP({ access_token: v })} placeholder="APP_USR-..." />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Webhook Secret / Signature</label>
              <SecretInput value={mp.webhook_secret} onChange={(v) => setMP({ webhook_secret: v })} placeholder="Clave secreta del webhook" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              <p className="font-semibold mb-1">URL de webhook (configurar en MercadoPago Developers)</p>
              <code className="break-all">/webhooks/scheduling/mercadopago</code>
              <a href="https://www.mercadopago.cl/developers/es/docs" target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-primary hover:underline">
                Ver documentación MercadoPago <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </SectionCard>

        {/* Efectivo */}
        <SectionCard
          icon={<Banknote className="h-6 w-6" />}
          title="Efectivo"
          subtitle="Cobro presencial en el local"
          enabled={cash.enabled}
          onToggle={(v) => setSettings((s) => ({ ...s, cash: { enabled: v } }))}
        >
          <p className="text-sm text-slate-500">El pago en efectivo siempre está disponible al cerrar una atención desde el Panel.</p>
        </SectionCard>

        {/* Transferencia bancaria */}
        <SectionCard
          icon={<MaterialIcon name="account_balance" className="text-2xl" />}
          title="Transferencia bancaria"
          subtitle="Depósito o transferencia CLP / RUT"
          enabled={transfer.enabled}
          onToggle={(v) => setTransfer({ enabled: v })}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Banco</label>
              <input value={transfer.bank_name} onChange={(e) => setTransfer({ bank_name: e.target.value })} className="input-field" placeholder="Ej: Banco de Chile" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Tipo de cuenta</label>
              <select value={transfer.account_type} onChange={(e) => setTransfer({ account_type: e.target.value })} className="input-field">
                <option value="cuenta_corriente">Cuenta corriente</option>
                <option value="cuenta_vista">Cuenta vista / RUT</option>
                <option value="cuenta_ahorro">Cuenta de ahorro</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Número de cuenta</label>
              <input value={transfer.account_number} onChange={(e) => setTransfer({ account_number: e.target.value })} className="input-field" placeholder="000-00000-00" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">RUT del titular</label>
              <input value={transfer.rut} onChange={(e) => setTransfer({ rut: e.target.value })} className="input-field" placeholder="12.345.678-9" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Nombre del titular</label>
              <input value={transfer.account_holder} onChange={(e) => setTransfer({ account_holder: e.target.value })} className="input-field" placeholder="Nombre completo o razón social" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Email para confirmación</label>
              <input type="email" value={transfer.email} onChange={(e) => setTransfer({ email: e.target.value })} className="input-field" placeholder="pagos@tu-negocio.cl" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Estos datos se mostrarán al cliente después de reservar para que realice la transferencia.</p>
        </SectionCard>
      </div>

      {/* Save */}
      <div className="mt-8 flex items-center justify-between rounded-2xl border border-primary/10 bg-primary/5 px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-on-surface">{activeCount} método{activeCount !== 1 ? "s" : ""} habilitado{activeCount !== 1 ? "s" : ""}</p>
          <p className="text-xs text-slate-500">Los cambios se aplican inmediatamente al guardar</p>
        </div>
        <button type="button" onClick={() => save.mutate()} disabled={save.isPending || !storeId}
          className="btn-primary flex items-center gap-2">
          <Save className="h-4 w-4" />
          {save.isPending ? "Guardando…" : "Guardar configuración"}
        </button>
      </div>
    </AppLayout>
  );
}
