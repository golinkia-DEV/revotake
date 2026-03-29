"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import Link from "next/link";

const publicApi = axios.create({ baseURL: API_URL });

export default function ManageBookingPage() {
  const params = useParams();
  const token = params.token as string;
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["pub-manage", token],
    queryFn: () => publicApi.get(`/public/scheduling/manage/${token}`).then((r) => r.data),
    enabled: !!token,
  });

  const cancel = useMutation({
    mutationFn: () => publicApi.post(`/public/scheduling/manage/${token}/cancel`),
    onSuccess: () => {
      toast.success("Cita cancelada");
      qc.invalidateQueries({ queryKey: ["pub-manage", token] });
    },
    onError: () => toast.error("No se pudo cancelar"),
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
