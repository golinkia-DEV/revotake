"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, User, Sparkles, Loader2 } from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hola. Soy tu asistente de RevoTake. Puedo ayudarte con clientes, reuniones, stock y tickets. ¿En qué puedo ayudarte hoy?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const res = await api.post("/ai/chat", { message: userMsg });
      setMessages((m) => [...m, { role: "assistant", content: res.data.response }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Error al conectar con el asistente. Verifica que ANTHROPIC_API_KEY esté configurada.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Asistente IA</h1>
          <p className="text-slate-500">Con contexto de tu negocio</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tertiary text-white shadow-lg shadow-tertiary/25">
          <MaterialIcon name="psychology" className="text-2xl" filled />
        </div>
      </div>
      <div className="flex h-[calc(100vh-220px)] min-h-[320px] flex-col overflow-hidden rounded-3xl border border-slate-100 bg-surface-container-lowest shadow-sm">
        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-6">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                    msg.role === "assistant" ? "bg-tertiary text-white" : "bg-surface-container-high text-slate-600"
                  }`}
                >
                  {msg.role === "assistant" ? <Sparkles className="h-4 w-4 text-white" /> : <User className="h-4 w-4" />}
                </div>
                <div
                  className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "assistant" ? "border border-slate-100 bg-white text-slate-700 shadow-sm" : "bg-gradient-to-r from-primary to-primary-container text-white"
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-tertiary">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="border-t border-slate-100 bg-surface-container-low/50 p-4">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              className="input-field rounded-full"
              placeholder="Escribe un mensaje..."
            />
            <button type="button" onClick={sendMessage} disabled={loading || !input.trim()} className="btn-primary flex-shrink-0 px-4">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
