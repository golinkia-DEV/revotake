"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getStoreId } from "@/lib/store";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Sparkles, User } from "lucide-react";
import api from "@/lib/api";

interface HelpMsg { role: "user" | "assistant"; content: string }

function HelpChat({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<HelpMsg[]>([
    { role: "assistant", content: "Hola 👋 Soy la ayuda de RevoTake. Pregúntame cómo usar cualquier función de la plataforma." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await api.post("/ai/help", { message: msg });
      setMessages((m) => [...m, { role: "assistant", content: res.data.response }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Error al conectar con el asistente." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      className="fixed bottom-20 right-4 z-50 flex w-[calc(100vw-32px)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:bottom-24 sm:right-6 sm:w-80 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between bg-primary px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold">Ayuda RevoTake</span>
        </div>
        <button type="button" onClick={onClose} className="text-white/70 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex max-h-[40vh] flex-col gap-3 overflow-y-auto p-3 sm:max-h-72">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white ${m.role === "assistant" ? "bg-primary" : "bg-slate-400"}`}>
              {m.role === "assistant" ? <Sparkles className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            </div>
            <div className={`max-w-[220px] rounded-xl px-3 py-2 text-xs leading-relaxed ${m.role === "assistant" ? "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200" : "bg-primary text-white"}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-400 dark:bg-slate-800">Pensando…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="¿Cómo funciona…?"
          className="flex-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button type="button" onClick={send} disabled={!input.trim() || loading} className="rounded-full bg-primary p-2 text-white disabled:opacity-40">
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (pathname?.startsWith("/profesional")) return;
    if (!isAuthenticated()) router.push("/login");
  }, [router, pathname]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    if (pathname === "/login" || pathname?.startsWith("/stores") || pathname?.startsWith("/profesional")) return;
    if (!getStoreId()) router.replace("/stores");
  }, [pathname, router]);

  // Cierra el sidebar al cambiar de ruta en mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-h-screen flex-col md:ml-64">
        <TopBar onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">{children}</main>
      </div>

      {/* Botón flotante ayuda */}
      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
        aria-label="Ayuda"
      >
        <AnimatePresence mode="wait">
          {showHelp
            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><X className="h-5 w-5 sm:h-6 sm:w-6" /></motion.span>
            : <motion.span key="h" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><Sparkles className="h-5 w-5 sm:h-6 sm:w-6" /></motion.span>
          }
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {showHelp && <HelpChat onClose={() => setShowHelp(false)} />}
      </AnimatePresence>
    </div>
  );
}
