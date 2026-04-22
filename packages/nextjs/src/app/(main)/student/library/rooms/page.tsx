"use client";

/**
 * Página de reserva de salas del ESTUDIANTE.
 *
 * Reglas:
 * - Solo se puede reservar para HOY (no días futuros)
 * - 1 reserva por día, máx 4h consecutivas
 * - Si ya tienes reserva: puedes ver disponibilidad de salas (modo lectura) pero no reservar
 * - Si cancelas la reserva, puedes volver a reservar
 */

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { toastRewards } from "@/lib/rewardToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { SkeletonPage, Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { RoomAvailabilityGrid } from "@/components/shared/RoomAvailabilityGrid";
import { BookingModal } from "@/components/shared/BookingModal";
import { BookingCard } from "@/components/shared/BookingCard";
import { RoomSelectorCard } from "@/components/shared/RoomSelectorCard";
import { icons } from "@/components/ui/icons";

interface Room {
  id: string; roomId: number; name: string; description: string | null;
  location: string | null; capacity: number; amenities: Record<string, boolean> | null;
}

interface MyBooking {
  id: string; bookingId: number; date: string; startHour: number;
  duration: number; cancelled: boolean;
  room: { name: string; location: string | null };
}

export default function StudentRoomsPage() {
  const { addToast } = useToast();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [availability, setAvailability] = useState<boolean[]>(Array(24).fill(true));
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const [startHour, setStartHour] = useState<number | null>(null);
  const [duration, setDuration] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [booking, setBooking] = useState(false);

  // Siempre hoy
  const todayStr = new Date().toISOString().split("T")[0];

  const loadData = useCallback(async () => {
    try {
      const [roomsRes, bookingsRes] = await Promise.all([
        fetch("/api/rooms"), fetch("/api/rooms/bookings/my"),
      ]);
      const roomsData = await roomsRes.json();
      const bookingsData = await bookingsRes.json();
      setRooms(roomsData.items ?? (Array.isArray(roomsData) ? roomsData : []));
      setMyBookings(Array.isArray(bookingsData) ? bookingsData : []);
    } catch { /* no-op */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Reserva activa de hoy (si existe)
  const todayBooking = myBookings.find(
    (b) => !b.cancelled && b.date.startsWith(todayStr),
  );
  const hasBookingToday = !!todayBooking;

  // Cargar disponibilidad cuando cambia la sala seleccionada
  useEffect(() => {
    if (!selectedRoom) return;
    async function loadAvailability() {
      setLoadingAvailability(true);
      try {
        const res = await fetch(`/api/rooms/${selectedRoom!.id}/availability?date=${todayStr}`);
        const data = await res.json();
        setAvailability(data.availability || Array(24).fill(true));
      } catch { setAvailability(Array(24).fill(true)); }
      finally { setLoadingAvailability(false); }
    }
    loadAvailability();
    setStartHour(null);
    setDuration(1);
  }, [selectedRoom, todayStr]);

  function handleSlotSelect(start: number, dur: number) {
    if (dur === 0) {
      setStartHour(null);
      setDuration(1);
    } else {
      setStartHour(start);
      setDuration(dur);
    }
  }

  async function handleConfirmBooking() {
    if (!selectedRoom || startHour === null) return;
    setBooking(true);
    try {
      const res = await fetch("/api/rooms/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: selectedRoom.id, date: todayStr, startHour, duration }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();

      addToast("Sala reservada correctamente", "success");
      toastRewards(addToast, data.rewards);
      setShowModal(false);
      setStartHour(null);
      setDuration(1);
      setSelectedRoom(null);
      loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al reservar", "danger");
    } finally { setBooking(false); }
  }

  async function handleCancelBooking(bookingId: string) {
    try {
      const res = await fetch(`/api/rooms/bookings/${bookingId}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast("Reserva cancelada. Puedes reservar otro horario.", "success");
      setStartHour(null);
      setDuration(1);
      loadData();
      // Recargar disponibilidad si hay sala seleccionada
      if (selectedRoom) {
        const avRes = await fetch(`/api/rooms/${selectedRoom.id}/availability?date=${todayStr}`);
        const avData = await avRes.json();
        setAvailability(avData.availability || Array(24).fill(true));
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    }
  }

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-8">
      <BackLink href="/student/library" label="Volver a biblioteca" />
      <div>
        <h1 className="text-2xl font-bold text-text">Salas de estudio</h1>
        <p className="text-text-muted mt-1">
          Reserva para hoy. Máximo 4 horas consecutivas, 1 sala por día.
        </p>
      </div>

      {/* ── Reserva activa de hoy ── */}
      {todayBooking && (
        <section className="space-y-4">
          <SectionTitle icon={icons.calendar}>Tu reserva de hoy</SectionTitle>
          <BookingCard
            roomName={todayBooking.room.name}
            roomLocation={todayBooking.room.location}
            date={todayBooking.date}
            startHour={todayBooking.startHour}
            duration={todayBooking.duration}
            onCancel={() => handleCancelBooking(todayBooking.id)}
            bookingId={todayBooking.bookingId}
          />
          <p className="text-sm text-text-muted">
            Ya tienes una reserva para hoy. Puedes consultar la disponibilidad de las salas,
            pero no podrás hacer otra reserva a menos que canceles la actual.
          </p>
        </section>
      )}

      {/* ── Selector de sala ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.rooms}>
          {hasBookingToday ? "Consultar disponibilidad" : "Salas disponibles"}
        </SectionTitle>
        {rooms.length === 0 ? (
          <EmptyState title="Sin salas" description="No hay salas disponibles." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rooms.map((room) => (
              <RoomSelectorCard
                key={room.id}
                name={room.name}
                location={room.location}
                capacity={room.capacity}
                amenities={room.amenities}
                selected={selectedRoom?.id === room.id}
                onClick={() => setSelectedRoom(room)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Disponibilidad ── */}
      {selectedRoom && (
        <section className="space-y-4">
          <SectionTitle icon={icons.calendar}>
            Disponibilidad hoy — {selectedRoom.name}
          </SectionTitle>

          {loadingAvailability ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <RoomAvailabilityGrid
              availability={availability}
              onSelect={handleSlotSelect}
              readOnly={hasBookingToday}
            />
          )}

          {hasBookingToday && (
            <p className="text-sm text-text-muted">
              Modo consulta — cancela tu reserva actual para poder reservar otro horario.
            </p>
          )}

          {!hasBookingToday && startHour !== null && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-muted">
                Asegúrate de que el horario es correcto. Solo puedes hacer una reserva al día.
              </p>
              <Button onClick={() => setShowModal(true)}>
                Reservar {startHour}:00 - {startHour + duration}:00
              </Button>
            </div>
          )}
        </section>
      )}

      {/* ── Modal confirmación ── */}
      {selectedRoom && startHour !== null && !hasBookingToday && (
        <BookingModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onConfirm={handleConfirmBooking}
          loading={booking}
          roomName={selectedRoom.name}
          date={todayStr}
          startHour={startHour}
          duration={duration}
        />
      )}
    </div>
  );
}
