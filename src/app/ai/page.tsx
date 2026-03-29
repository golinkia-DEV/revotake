"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, User, Sparkles, Loader2 } from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";

interface Message { role: "user" | "assistant"; content: string; }

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hola! Soy tu asistente de RevoTake. Puedo ayudarte con clientes, reuniones, stock, tickets y mas. En que puedo ayudarte hoy?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const res = await api.post("/ai/chat", { message: userMsg });
      setMessages(m => [...m, { role: "assistant", content: res.data.response }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Error al conectar con el asistente. Verifica que ANTHROPIC_API_KEY este configurada." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-1">Asistente IA</h1>
        <p className="text-gray-400">Powered by Claude — con contexto de tu negocio</p>
      </div>
      <div className="glass-card flex flex-col h-[calc(100vh-220px)]">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role === "assistant" ? "bg-brand-600" : "bg-dark-500"}`}>
                  {msg.role === "assistant" ? <Sparkles className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-gray-300" />}
                </div>
                <div className={`max-w-2xl px-4 py-3 rounded-2xl text-sm ${msg.role === "assistant" ? "bg-dark-600 text-gray-200" : "bg-brand-600 text-white"}`}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-dark-600">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="p-4 border-t border-white/5">
          <div className="flex gap-3">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()} className="input-field" placeholder="Escribe un mensaje..." />
            <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn-primary px-4 flex-shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
