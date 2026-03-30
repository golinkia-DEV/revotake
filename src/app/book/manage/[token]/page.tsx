"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Calendar, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import Link from "next/link";

const publicApi = axios.create({ baseURL: API_URL });

type ManageData = {
  id: string;
  status: string;
  start_time: string;
  end_time: string;
  service: { name: string };
  professional: { id: string | null; name: string };
  branch: { name: string };
  payment_mode: string;
  payment_status: string;
  review: {
    can_submit: boolean;
    existing: { rating: number; comment: string | null; created_at: string } | null;
  };
};

export default function ManageBookingPage() {
  const params = useParams();
  const token = params.token as string;
  const qc = useQueryClient();
  const [ratingPick, setRatingPick] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["pub-manage", token],
    queryFn: () => publicApi.get(`/public/scheduling/manage/${token}`).then((r) => r.data as ManageData),
    enabled: !!token,
  });

  const cancel = useMutation({
    mutationFn: () => publicApi.post(`/public/scheduling/manage/${token}/cancel`),
    onSuccess: (res) => {
      const d = res.data;
      if (d.cancellation_fee_message) {
        toast.warning(`Cita cancelada. ${d.cancellation_fee_message}`);
      } else {
        toast.success("Cita cancelada");
      }
      qc.invalidateQueries({ queryKey: ["pub-manage", token] });
    },
    onError: () => toast.error("No se pudo cancelar"),
  });

  const submitReview = useMutation({
    mutationFn: () =>
      publicApi.post(`/public/scheduling/manage/${token}/review`, {
        rating: ratingPick,
        comment: comment.trim() || null,
      }),
    onSuccess: () => {
      toast.success("¡Gracias por tu calificación!");
      setRatingPick(null);
      setComment("");
      qc.invalidateQueries({ queryKey: ["pub-manage", token] });
    },
    onError: (e: unknown) => {
      const msg = axios.isAxiosError(e) ? e.response?.data?.detail : null;
      toast.error(typeof msg === "string" ? msg : "No se pudo enviar la calificación");
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6">
        <p className="text-slate-600">Enlace no válido o expirado.</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Inicio
        </Link>
      </div>
    );
  }

  const cancelled = data.status === "cancelled";
  const existing = data.review?.existing;
  const canSubmit = data.review?.can_submit === true;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-12">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Tu cita</h1>
            <p className="text-sm text-slate-500">{data.service?.name}</p>
          </div>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Profesional</dt>
            <dd className="font-medium">{data.professional?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Sucursal</dt>
            <dd className="font-medium">{data.branch?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Inicio</dt>
            <dd className="font-medium">{new Date(data.start_time).toLocaleString("es-CL")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Estado</dt>
            <dd className="font-medium">{data.status}</dd>
          </div>
        </dl>

        {!cancelled && existing && (
          <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Tu calificación</p>
            <p className="mt-2 text-amber-700">
              {"★".repeat(existing.rating)}
              {"☆".repeat(5 - existing.rating)}
            </p>
            {existing.comment && <p className="mt-2 text-sm text-slate-700">{existing.comment}</p>}
            <p className="mt-2 text-xs text-slate-500">
              {new Date(existing.created_at).toLocaleString("es-CL")}
            </p>
          </div>
        )}

        {!cancelled && canSubmit && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold text-slate-800">¿Cómo fue tu experiencia?</p>
            <p className="mt-1 text-xs text-slate-500">
              Ayudá a otros clientes: calificá al profesional y al servicio. Una opinión por cita.
            </p>
            <div className="mt-3 flex justify-center gap-1" role="group" aria-label="Estrellas del 1 al 5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRatingPick(n)}
                  className={`rounded-lg px-2 py-1 text-2xl transition ${
                    ratingPick != null && n <= ratingPick ? "text-amber-500" : "text-slate-300 hover:text-amber-300"
                  }`}
                  aria-label={`${n} estrellas`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comentario opcional (máx. 500 caracteres)"
              maxLength={500}
              rows={3}
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={submitReview.isPending || ratingPick == null}
              onClick={() => submitReview.mutate()}
              className="mt-3 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitReview.isPending ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Enviar calificación"}
            </button>
          </div>
        )}

        {!cancelled && !canSubmit && !existing && (
          <p className="mt-6 text-center text-xs text-slate-500">
            Cuando termine el horario de tu cita podrás dejar una calificación desde este mismo enlace.
          </p>
        )}

        {!cancelled && (
          <button
            type="button"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
            className="mt-6 w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {cancel.isPending ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Cancelar cita"}
          </button>
        )}
        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-600">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
