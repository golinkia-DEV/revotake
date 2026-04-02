"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Clock,
  Scissors,
  Users,
  Sparkles,
  ArrowRight,
  Loader2,
  SkipForward,
} from "lucide-react";
import api from "@/lib/api";
import { getStoreId, setStoreId } from "@/lib/store";
import { toast } from "sonner";
import clsx from "clsx";

// ─── Utils ────────────────────────────────────────────────────────────────────
const ONBOARDING_KEY = (storeId: string) => `onboarding_done_${storeId}`;

const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAYS_EN = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

interface DaySchedule {
  enabled: boolean;
  open: string;
  close: string;
}

function defaultSchedule(): Record<string, DaySchedule> {
  return Object.fromEntries(
    DAYS_EN.map((d, i) => [
      d,
      { enabled: i < 6, open: "09:00", close: "19:00" },
    ])
  );
}

// ─── Paso 1: Bienvenida ───────────────────────────────────────────────────────
function StepWelcome({ storeName, onNext }: { storeName: string; onNext: () => void }) {
  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      className="text-center"
    >
      <div className="mb-6 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-rose-500 shadow-lg">
          <Sparkles className="h-10 w-10 text-white" />
        </div>
      </div>
      <h2 className="text-2xl font-extrabold text-slate-900 mb-3">
        ¡Bienvenido a RevoTake!
      </h2>
      <p className="text-slate-500 mb-2 text-base">
        Tu tienda <strong className="text-violet-700">{storeName}</strong> está lista.
      </p>
      <p className="text-slate-500 mb-8">
        En 3 pasos rápidos vamos a configurar tu agenda para que puedas recibir reservas hoy mismo.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { icon: Clock, label: "Horario" },
          { icon: Scissors, label: "1er servicio" },
          { icon: Users, label: "Equipo" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 py-4 px-2"
          >
            <Icon className="h-5 w-5 text-violet-600" />
            <span className="text-xs font-semibold text-violet-700">{label}</span>
          </div>
        ))}
      </div>

      <button onClick={onNext} className="btn-primary w-full flex items-center justify-center gap-2">
        Empezar configuración
        <ChevronRight className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

// ─── Paso 2: Horario ──────────────────────────────────────────────────────────
function StepSchedule({
  schedule,
  onChange,
  onNext,
  onBack,
  loading,
}: {
  schedule: Record<string, DaySchedule>;
  onChange: (s: Record<string, DaySchedule>) => void;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  function toggle(day: string) {
    onChange({ ...schedule, [day]: { ...schedule[day], enabled: !schedule[day].enabled } });
  }
  function setTime(day: string, field: "open" | "close", val: string) {
    onChange({ ...schedule, [day]: { ...schedule[day], [field]: val } });
  }

  return (
    <motion.div
      key="schedule"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
    >
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-1">
          Paso 1 de 3
        </p>
        <h2 className="text-xl font-extrabold text-slate-900 mb-1">Horario de atención</h2>
        <p className="text-sm text-slate-500">
          Configura los días y horarios en que tu negocio atiende.
        </p>
      </div>

      <div className="space-y-2 mb-6">
        {DAYS_EN.map((day, i) => {
          const d = schedule[day];
          return (
            <div
              key={day}
              className={clsx(
                "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                d.enabled
                  ? "border-violet-200 bg-violet-50"
                  : "border-slate-200 bg-slate-50"
              )}
            >
              <button
                type="button"
                onClick={() => toggle(day)}
                className={clsx(
                  "relative h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
                  d.enabled ? "bg-violet-600" : "bg-slate-300"
                )}
              >
                <span
                  className={clsx(
                    "absolute top-0 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    d.enabled ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
              <span
                className={clsx(
                  "w-8 text-sm font-bold",
                  d.enabled ? "text-violet-700" : "text-slate-400"
                )}
              >
                {DAYS_ES[i]}
              </span>
              {d.enabled ? (
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="time"
                    value={d.open}
                    onChange={(e) => setTime(day, "open", e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                  <span className="text-slate-400 text-xs">—</span>
                  <input
                    type="time"
                    value={d.close}
                    onChange={(e) => setTime(day, "close", e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              ) : (
                <span className="ml-auto text-xs text-slate-400">Cerrado</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary flex-1 flex items-center justify-center gap-2">
          <ChevronLeft className="h-4 w-4" />
          Atrás
        </button>
        <button
          onClick={onNext}
          disabled={loading}
          className="btn-primary flex-2 flex items-center justify-center gap-2 flex-1"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar y continuar
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Paso 3: Primer servicio ──────────────────────────────────────────────────
function StepFirstService({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: (data: { name: string; duration: number; price: number }) => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState(0);

  function handleNext() {
    if (!name.trim()) { toast.error("Escribe el nombre del servicio"); return; }
    onNext({ name: name.trim(), duration, price: price * 100 }); // price en pesos → cents
  }

  return (
    <motion.div
      key="service"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
    >
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-1">
          Paso 2 de 3
        </p>
        <h2 className="text-xl font-extrabold text-slate-900 mb-1">Crea tu primer servicio</h2>
        <p className="text-sm text-slate-500">
          Esto aparecerá en tu página pública de reservas.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Nombre del servicio *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Ej: Corte de cabello, Consulta médica, Manicure…'
            className="input-field"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Duración (minutos)
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="input-field"
            >
              {[15, 20, 30, 45, 60, 90, 120].map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Precio (CLP)
            </label>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              placeholder="0"
              className="input-field"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary flex items-center justify-center gap-1 px-4">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button onClick={handleNext} className="btn-primary flex-1 flex items-center justify-center gap-2">
          Crear servicio
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={onSkip}
          className="flex items-center gap-1 px-3 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          <SkipForward className="h-4 w-4" />
          Saltar
        </button>
      </div>
    </motion.div>
  );
}

// ─── Paso 4: Equipo ───────────────────────────────────────────────────────────
function StepTeam({
  onNext,
  onBack,
}: {
  onNext: (email: string | null) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");

  return (
    <motion.div
      key="team"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
    >
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-1">
          Paso 3 de 3
        </p>
        <h2 className="text-xl font-extrabold text-slate-900 mb-1">Invita a tu equipo</h2>
        <p className="text-sm text-slate-500">
          ¿Trabajas con colaboradores? Agrégalos ahora o más tarde desde{" "}
          <strong>Equipo y permisos</strong>.
        </p>
      </div>

      <div className="mb-6">
        <label className="mb-1 block text-sm font-semibold text-slate-700">
          Email del primer miembro (opcional)
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colaborador@tuempresa.cl"
          className="input-field"
        />
        <p className="mt-1 text-xs text-slate-400">
          Recibirán una invitación para unirse a tu tienda.
        </p>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary flex items-center justify-center gap-1 px-4">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onNext(email.trim() || null)}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          {email.trim() ? "Enviar invitación" : "Saltar por ahora"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Paso 5: Completado ───────────────────────────────────────────────────────
function StepDone({ storeName, onGo }: { storeName: string; onGo: () => void }) {
  return (
    <motion.div
      key="done"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.1 }}
        className="mb-6 flex justify-center"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 border-4 border-emerald-200">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>
      </motion.div>
      <h2 className="text-2xl font-extrabold text-slate-900 mb-3">
        ¡Todo listo, {storeName.split(" ")[0]}!
      </h2>
      <p className="text-slate-500 mb-8">
        Tu tienda está configurada y lista para recibir reservas. Puedes editar todo esto
        cuando quieras desde Configuración.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-8 text-left">
        {[
          { label: "Agenda en vivo", href: "/calendar", icon: "📅" },
          { label: "Panel de hoy", href: "/scheduling/panel", icon: "🎯" },
          { label: "Tus servicios", href: "/scheduling/services", icon: "✂️" },
          { label: "Configuración", href: "/settings", icon: "⚙️" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 hover:border-violet-200 hover:bg-violet-50 transition-colors"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-sm font-semibold text-slate-700">{item.label}</span>
          </a>
        ))}
      </div>

      <button onClick={onGo} className="btn-primary w-full flex items-center justify-center gap-2">
        Ir al Dashboard
        <ArrowRight className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const [step, setStep] = useState(0); // 0=welcome 1=schedule 2=service 3=team 4=done
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(defaultSchedule());
  const [savingSchedule, setSavingSchedule] = useState(false);

  const { data: storeData } = useQuery({
    queryKey: ["store-onboarding", storeId],
    queryFn: () => api.get(`/stores/${storeId}`).then((r) => r.data),
    enabled: !!storeId,
  });

  const storeName = storeData?.name ?? "Tu tienda";

  // Si ya hizo onboarding, redirigir
  useEffect(() => {
    if (storeId && localStorage.getItem(ONBOARDING_KEY(storeId))) {
      router.replace("/dashboard");
    }
  }, [storeId, router]);

  async function saveSchedule() {
    if (!storeId) return;
    setSavingSchedule(true);
    try {
      const currentSettings = storeData?.settings ?? {};
      const horarios: Record<string, { open: string; close: string } | null> = {};
      for (const [day, d] of Object.entries(schedule)) {
        horarios[day] = d.enabled ? { open: d.open, close: d.close } : null;
      }
      await api.patch(`/stores/${storeId}`, {
        settings: {
          ...currentSettings,
          store_profile: {
            ...((currentSettings.store_profile as Record<string, unknown>) ?? {}),
            horarios,
          },
        },
      });
    } catch (err) {
      console.error(err);
      toast.error("No se pudo guardar el horario");
    } finally {
      setSavingSchedule(false);
    }
  }

  const createServiceMut = useMutation({
    mutationFn: (data: { name: string; duration: number; price: number }) =>
      api.post("/scheduling/services", {
        name: data.name,
        duration_minutes: data.duration,
        price_cents: data.price,
        currency: "CLP",
      }),
  });

  const inviteMut = useMutation({
    mutationFn: (email: string) =>
      api.post("/scheduling/professionals", {
        name: email.split("@")[0],
        email,
        invite_member_role: "STORE_WORKER",
      }),
  });

  async function handleSaveSchedule() {
    await saveSchedule();
    setStep(2);
  }

  async function handleCreateService(data: { name: string; duration: number; price: number }) {
    try {
      await createServiceMut.mutateAsync(data);
      toast.success("Servicio creado");
    } catch {
      toast.error("Error al crear servicio, puedes crearlo luego");
    }
    setStep(3);
  }

  async function handleTeam(email: string | null) {
    if (email) {
      try {
        await inviteMut.mutateAsync(email);
        toast.success(`Invitación enviada a ${email}`);
      } catch {
        toast.error("No se pudo enviar la invitación, puedes hacerlo luego");
      }
    }
    if (storeId) {
      localStorage.setItem(ONBOARDING_KEY(storeId), "1");
    }
    setStep(4);
  }

  function goDashboard() {
    router.push("/dashboard");
  }

  if (!storeId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <p className="text-slate-500">Sin tienda activa. <a href="/stores" className="text-violet-600 underline">Crear tienda</a></p>
      </div>
    );
  }

  const TOTAL_STEPS = 5;
  const progress = Math.round((step / (TOTAL_STEPS - 1)) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-rose-500">
            <span className="text-sm font-black text-white">RT</span>
          </div>
          <span className="font-extrabold text-slate-900 text-lg">RevoTake</span>
        </div>

        {/* Progress */}
        {step > 0 && step < 4 && (
          <div className="mb-6">
            <div className="h-1.5 w-full rounded-full bg-slate-200">
              <motion.div
                className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-rose-500"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <p className="mt-2 text-center text-xs text-slate-400">Paso {step} de 3</p>
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl bg-white shadow-xl border border-slate-100 p-8">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <StepWelcome storeName={storeName} onNext={() => setStep(1)} />
            )}
            {step === 1 && (
              <StepSchedule
                schedule={schedule}
                onChange={setSchedule}
                onNext={handleSaveSchedule}
                onBack={() => setStep(0)}
                loading={savingSchedule}
              />
            )}
            {step === 2 && (
              <StepFirstService
                onNext={handleCreateService}
                onBack={() => setStep(1)}
                onSkip={() => setStep(3)}
              />
            )}
            {step === 3 && (
              <StepTeam
                onNext={handleTeam}
                onBack={() => setStep(2)}
              />
            )}
            {step === 4 && (
              <StepDone storeName={storeName} onGo={goDashboard} />
            )}
          </AnimatePresence>
        </div>

        {/* Skip all */}
        {step > 0 && step < 4 && (
          <button
            onClick={() => {
              if (storeId) localStorage.setItem(ONBOARDING_KEY(storeId), "1");
              router.push("/dashboard");
            }}
            className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Saltar configuración y explorar por mi cuenta →
          </button>
        )}
      </div>
    </div>
  );
}
