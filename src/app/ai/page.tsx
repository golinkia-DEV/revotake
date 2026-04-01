"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, Sparkles } from "lucide-react";
import api from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { getStoreId } from "@/lib/store";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  "¿Cómo agrego un cliente?",
  "¿Cómo configuro mis servicios?",
  "¿Cómo funciona la agenda?",
  "¿Cómo ver mis ventas?",
];

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 dark:bg-slate-800">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

export default function AIPage() {
  const storeId = typeof window !== "undefined" ? getStoreId() : null;
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hola. Soy tu asistente de RevoTake. Puedo ayudarte con clientes, reuniones, stock y tickets. ¿En qué puedo ayudarte hoy?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({
    queryKey: ["auth-me-ai", storeId],
    queryFn: () => api.get("/auth/me").then((r) => r.data),
    enabled: !!storeId,
    staleTime: 60_000,
  });

  const storeName = me?.store_context?.store_name ?? "tu negocio";

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text?: string) {
    const userMsg = (text ?? input).trim();
    if (!userMsg || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg, timestamp: new Date() }]);
    setLoading(true);
    try {
      const res = await api.post("/ai/chat", { message: userMsg });
      setMessages((m) => [...m, { role: "assistant", content: res.data.response, timestamp: new Date() }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Error al conectar con el asistente. Verifica que ANTHROPIC_API_KEY esté configurada.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const hasOnlyInitial = messages.length === 1;

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-80px)] flex-col">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 shadow-md shadow-blue-600/25">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Asistente RevoTake</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Claude AI
              </span>
            </div>
            <p className="text-xs text-slate-500">{storeName}</p>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-4 p-4">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div className={`flex max-w-[75%] flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={
                        msg.role === "user"
                          ? "rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm leading-relaxed text-white"
                          : "rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-sm leading-relaxed text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                      }
                    >
                      {msg.content}
                    </div>
                    <p className="px-1 text-[10px] text-slate-400">{fmtTime(msg.timestamp)}</p>
                  </div>
                </motion.div>
              ))}

              {loading && (
                <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <TypingIndicator />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Suggestion chips (only shown when no extra messages yet) */}
            {hasOnlyInitial && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-2 pt-2"
              >
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            disabled={loading}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-50 transition-all"
            placeholder="Escribe tu pregunta…"
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
