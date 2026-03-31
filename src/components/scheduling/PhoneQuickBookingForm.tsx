"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import api from "@/lib/api";
import { getStoreId } from "@/lib/store";
import { toast } from "sonner";

interface BranchRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}
interface ServiceRow {
  id: string;
  name: string;
}

export type PhoneQuickBookingSyncBranch = {
  value: string;
  onChange: (id: string) => void;
};

type PhoneQuickBookingFormProps = {
  /** En /calendar, comparte la sede con el selector del calendario profesional. */
  syncBranch?: PhoneQuickBookingSyncBranch;
  className?: string;
  /** En topbar el panel ya tiene título; ocultar encabezado duplicado. */
  showHeading?: boolean;
  /** Tras reservar con éxito (p. ej. cerrar el panel del topbar). */
  onBooked?: () => void;
};

export function PhoneQuickBookingForm({ syncBranch, className, showHeading = true, onBooked }: PhoneQuickBookingFormProps) {
  const qc = useQueryClient();
  const storeId = getStoreId();

  const [internalBranch, setInternalBranch] = useState("");
  const selectedBranch = syncBranch ? syncBranch.value : internalBranch;
  const setSelectedBranch = syncBranch ? syncBranch.onChange : setInternalBranch;

  const [bookingMode, setBookingMode] = useState<"existing" | "new">("existing");
  const [bookingClientId, setBookingClientId] = useState("");
  const [newClient, setNewClient] = useState({
    name: "",
    paternal_last_name: "",
    maternal_last_name: "",
    birth_date: "",
    email: "",
    phone: "",
    address: "",
  });
  const [bookingServiceId, setBookingServiceId] = useState("");
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bookingTime, setBookingTime] = useState("");

  const { data: clientsData } = useQuery({
    queryKey: ["clients-phone-quick-booking"],
    queryFn: () => api.get("/clients/?limit=200").then((r) => r.data),
    enabled: !!storeId,
  });

  const { data: branchesData } = useQuery({
    queryKey: ["scheduling-branches", storeId],
    queryFn: () => api.get("/scheduling/branches").then((r) => r.data),
    enabled: !!storeId,
  });
  const { data: servicesData } = useQuery({
    queryKey: ["scheduling-services", storeId],
    queryFn: () => api.get("/scheduling/services").then((r) => r.data),
    enabled: !!storeId,
  });

  const branches: BranchRow[] = branchesData?.items ?? [];
  const services: ServiceRow[] = servicesData?.items ?? [];

  const recommendSlots = useQuery({
    queryKey: ["recommend-slots", storeId, selectedBranch, bookingServiceId, bookingDate, bookingTime],
    queryFn: () =>
      api
        .get("/scheduling/recommend-slots", {
          params: {
            branch_id: selectedBranch,
            service_id: bookingServiceId,
            on_date: bookingDate,
            preferred_time: bookingTime || undefined,
          },
        })
        .then((r) => r.data),
    enabled: !!storeId && !!selectedBranch && !!bookingServiceId && !!bookingDate,
  });

  const quickBook = useMutation({
    mutationFn: async (slot: { professional_id: string; start_time: string }) => {
      let clientId = bookingClientId || null;
      if (bookingMode === "new") {
        const c = await api.post("/clients/", {
          ...newClient,
          rut: null,
          address_lat: null,
          address_lng: null,
          preferences: {},
        });
        clientId = c.data.id as string;
      }
      if (!clientId) throw new Error("Selecciona o crea clienta");
      await api.post("/scheduling/appointments", {
        branch_id: selectedBranch,
        professional_id: slot.professional_id,
        service_id: bookingServiceId,
        client_id: clientId,
        start_time: slot.start_time,
        payment_mode: "on_site",
      });
    },
    onSuccess: () => {
      toast.success("Reserva creada");
      qc.invalidateQueries({ queryKey: ["pro-appointments"] });
      qc.invalidateQueries({ queryKey: ["meetings-agenda-hub"] });
      qc.invalidateQueries({ queryKey: ["scheduling-panel"] });
      qc.invalidateQueries({ queryKey: ["clients-calendar"] });
      qc.invalidateQueries({ queryKey: ["clients-phone-quick-booking"] });
      setBookingClientId("");
      onBooked?.();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "No se pudo reservar";
      toast.error(msg);
    },
  });

  if (!storeId) return null;

  return (
    <div className={className}>
      {showHeading ? (
        <>
          <h2 className="mb-2 text-lg font-bold text-on-surface">Reserva rápida telefónica</h2>
          <p className="mb-4 text-sm text-slate-500">
            Para clientas nuevas o existentes. Recomendación justa: prioriza menor carga y desempata aleatoriamente.
          </p>
        </>
      ) : (
        <p className="mb-4 text-sm text-slate-500">
          Para clientas nuevas o existentes. Recomendación justa: prioriza menor carga y desempata aleatoriamente.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <select className="input-field" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
          <option value="">Sede</option>
          {branches.filter((b) => b.is_active).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select className="input-field" value={bookingServiceId} onChange={(e) => setBookingServiceId(e.target.value)}>
          <option value="">Servicio</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input type="date" className="input-field" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
        <input type="time" className="input-field" value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={clsx("btn-ghost text-xs", bookingMode === "existing" && "bg-primary/10 text-primary")}
          onClick={() => setBookingMode("existing")}
        >
          Cliente existente
        </button>
        <button
          type="button"
          className={clsx("btn-ghost text-xs", bookingMode === "new" && "bg-primary/10 text-primary")}
          onClick={() => setBookingMode("new")}
        >
          Nueva clienta
        </button>
      </div>
      {bookingMode === "existing" ? (
        <div className="mt-3">
          <select className="input-field" value={bookingClientId} onChange={(e) => setBookingClientId(e.target.value)}>
            <option value="">Seleccionar clienta</option>
            {(clientsData?.items as { id: string; name: string; email: string | null }[] | undefined)?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.email ? ` (${c.email})` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            className="input-field"
            placeholder="Nombre"
            value={newClient.name}
            onChange={(e) => setNewClient((x) => ({ ...x, name: e.target.value }))}
          />
          <input
            className="input-field"
            placeholder="Apellido paterno"
            value={newClient.paternal_last_name}
            onChange={(e) => setNewClient((x) => ({ ...x, paternal_last_name: e.target.value }))}
          />
          <input
            className="input-field"
            placeholder="Apellido materno"
            value={newClient.maternal_last_name}
            onChange={(e) => setNewClient((x) => ({ ...x, maternal_last_name: e.target.value }))}
          />
          <input
            type="date"
            className="input-field"
            value={newClient.birth_date}
            onChange={(e) => setNewClient((x) => ({ ...x, birth_date: e.target.value }))}
          />
          <input
            className="input-field"
            placeholder="Email"
            value={newClient.email}
            onChange={(e) => setNewClient((x) => ({ ...x, email: e.target.value }))}
          />
          <input
            className="input-field"
            placeholder="Teléfono"
            value={newClient.phone}
            onChange={(e) => setNewClient((x) => ({ ...x, phone: e.target.value }))}
          />
          <input
            className="input-field md:col-span-3"
            placeholder="Dirección"
            value={newClient.address}
            onChange={(e) => setNewClient((x) => ({ ...x, address: e.target.value }))}
          />
        </div>
      )}
      <div className="mt-4 space-y-2">
        {(recommendSlots.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Sin recomendaciones aún para los filtros seleccionados.</p>
        ) : (
          (recommendSlots.data?.items ?? []).map(
            (r: { professional_id: string; professional_name: string; start_time: string; workload_today: number }) => (
              <div
                key={`${r.professional_id}-${r.start_time}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"
              >
                <div>
                  <p className="font-semibold text-on-surface">{r.professional_name}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(r.start_time).toLocaleString("es-CL")} · carga hoy {r.workload_today}
                  </p>
                </div>
                <button type="button" className="btn-primary text-xs" onClick={() => quickBook.mutate(r)} disabled={quickBook.isPending}>
                  Reservar
                </button>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
