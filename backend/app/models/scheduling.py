import enum
import uuid
from datetime import datetime, date, time

from sqlalchemy import (
    String,
    DateTime,
    Date,
    Time,
    Text,
    JSON,
    ForeignKey,
    Boolean,
    Integer,
    Float,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AvailabilityRuleType(str, enum.Enum):
    WEEKLY = "weekly"
    EXCEPTION = "exception"


class AppointmentStatus(str, enum.Enum):
    PENDING_PAYMENT = "pending_payment"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"


class PaymentMode(str, enum.Enum):
    ONLINE = "online"
    ON_SITE = "on_site"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    REFUNDED = "refunded"
    WAIVED = "waived"
    NOT_REQUIRED = "not_required"


class NotificationChannel(str, enum.Enum):
    EMAIL = "email"
    SMS = "sms"
    WHATSAPP = "whatsapp"


class NotificationJobKind(str, enum.Enum):
    REMINDER_24H = "reminder_24h"
    REMINDER_1H = "reminder_1h"
    BOOKING_CONFIRMATION = "booking_confirmation"
    POST_VISIT_REVIEW = "post_visit_review"
    REBOOKING_SUGGESTION = "rebooking_suggestion"
    WAITLIST_SLOT_AVAILABLE = "waitlist_slot_available"


class PaymentAttemptStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"


class Branch(Base):
    """Sucursal dentro de una tienda (tenant)."""
    __tablename__ = "branches"
    __table_args__ = (UniqueConstraint("store_id", "slug", name="uq_branch_store_slug"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(120), index=True)
    timezone: Mapped[str] = mapped_column(String(64), default="America/Santiago")
    # Ubicación (Chile): nombres según catálogo oficial de regiones/comunas
    region: Mapped[str | None] = mapped_column(String(200), nullable=True)
    comuna: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address_line: Mapped[str | None] = mapped_column(Text, nullable=True)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class WorkStation(Base):
    """Sillón, sala u otro puesto físico en una sede (ocupación vs disponible)."""

    __tablename__ = "work_stations"
    __table_args__ = (Index("ix_work_stations_branch_active", "branch_id", "is_active"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    # chair | room | other
    kind: Mapped[str] = mapped_column(String(32), default="chair")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class Professional(Base):
    __tablename__ = "professionals"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # Invitación: hasta que acepta correo y define contraseña, sin user_id
    invite_token: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    invite_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    invite_member_role: Mapped[str | None] = mapped_column(String(40), nullable=True)
    invite_branch_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    invite_worker_role: Mapped[str | None] = mapped_column(String(80), nullable=True)
    # % único sobre ventas de productos (inventario) para este profesional; null = sin comisión productos
    product_commission_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class ProfessionalBranch(Base):
    __tablename__ = "professional_branches"
    __table_args__ = (UniqueConstraint("professional_id", "branch_id", name="uq_prof_branch"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    professional_id: Mapped[str] = mapped_column(ForeignKey("professionals.id"), index=True)
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"), index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    # none: no consume puesto | fixed: sillón/sala asignado en esta sede | dynamic: el sistema asigna uno libre
    station_mode: Mapped[str] = mapped_column(String(16), default="none")
    default_station_id: Mapped[str | None] = mapped_column(ForeignKey("work_stations.id"), nullable=True, index=True)


class Service(Base):
    __tablename__ = "scheduling_services"
    __table_args__ = (UniqueConstraint("store_id", "slug", name="uq_service_store_slug"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(120))
    # Sección del menú público (peluquería: "Cortes", clínica: "Consultas", taller: "Mantención", etc.)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    menu_sort_order: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    buffer_before_minutes: Mapped[int] = mapped_column(Integer, default=0)
    buffer_after_minutes: Mapped[int] = mapped_column(Integer, default=0)
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(8), default="CLP")
    # Producto de inventario vinculado (precio lista estimado); el cobro en sala puede diferir.
    product_id: Mapped[str | None] = mapped_column(ForeignKey("products.id"), nullable=True, index=True)
    allow_price_override: Mapped[bool] = mapped_column(Boolean, default=True)
    # Política de cancelación: horas mínimas de antelación sin cobro
    cancellation_hours: Mapped[int] = mapped_column(Integer, default=24)
    # Cobro por cancelación tardía (0 = sin cobro)
    cancellation_fee_cents: Mapped[int] = mapped_column(Integer, default=0)
    # Depósito requerido al reservar (0 = sin depósito)
    deposit_required_cents: Mapped[int] = mapped_column(Integer, default=0)
    # Sugerencia de re-agendamiento N días después (0 = desactivado)
    suggest_rebooking_days: Mapped[int] = mapped_column(Integer, default=0)
    # Esquema de preguntas de intake (JSON array de campos)
    intake_form_schema: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # Hasta 5 URLs públicas de fotos del servicio (galería en reserva / menú)
    image_urls: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class ProfessionalService(Base):
    __tablename__ = "professional_services"
    __table_args__ = (UniqueConstraint("professional_id", "service_id", name="uq_prof_service"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    professional_id: Mapped[str] = mapped_column(ForeignKey("professionals.id"), index=True)
    service_id: Mapped[str] = mapped_column(ForeignKey("scheduling_services.id"), index=True)
    # % de comisión sobre el cobro del servicio (0–100); null se trata como 0 en reportes
    commission_percent: Mapped[float | None] = mapped_column(Float, nullable=True)


class AvailabilityRule(Base):
    """Horario semanal o excepción por fecha (cerrado o franja distinta)."""
    __tablename__ = "availability_rules"
    __table_args__ = (Index("ix_avail_prof_branch", "professional_id", "branch_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    professional_id: Mapped[str] = mapped_column(ForeignKey("professionals.id"), index=True)
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"), index=True)
    rule_type: Mapped[str] = mapped_column(String(32), default=AvailabilityRuleType.WEEKLY.value)
    weekday: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0=Mon .. 6=Sun, weekly only
    specific_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class Holiday(Base):
    __tablename__ = "scheduling_holidays"
    __table_args__ = (Index("ix_holiday_store_date", "store_id", "holiday_date"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    branch_id: Mapped[str | None] = mapped_column(ForeignKey("branches.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    holiday_date: Mapped[date] = mapped_column(Date, index=True)


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_appt_prof_start", "professional_id", "start_time"),
        Index("ix_appt_store_start", "store_id", "start_time"),
        Index("ix_appt_manage_token", "manage_token"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"), index=True)
    professional_id: Mapped[str] = mapped_column(ForeignKey("professionals.id"), index=True)
    service_id: Mapped[str] = mapped_column(ForeignKey("scheduling_services.id"), index=True)
    client_id: Mapped[str | None] = mapped_column(ForeignKey("clients.id"), nullable=True, index=True)
    station_id: Mapped[str | None] = mapped_column(ForeignKey("work_stations.id"), nullable=True, index=True)
    start_time: Mapped[datetime] = mapped_column(DateTime)
    end_time: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(32), default=AppointmentStatus.CONFIRMED.value, index=True)
    payment_mode: Mapped[str] = mapped_column(String(32), default=PaymentMode.ON_SITE.value)
    payment_status: Mapped[str] = mapped_column(String(32), default=PaymentStatus.NOT_REQUIRED.value)
    manage_token: Mapped[str] = mapped_column(String(64), default=lambda: str(uuid.uuid4()), unique=True)
    hold_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Ficha operaciones (Kanban) abierta al iniciar la franja de atención
    ticket_id: Mapped[str | None] = mapped_column(ForeignKey("tickets.id"), nullable=True, index=True)
    # Monto cobrado al cerrar (puede diferir de price_cents del servicio / producto)
    charged_price_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    session_closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)


class AppointmentAuditLog(Base):
    __tablename__ = "appointment_audit_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    appointment_id: Mapped[str] = mapped_column(ForeignKey("appointments.id"), index=True)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    actor_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class NotificationJob(Base):
    __tablename__ = "notification_jobs"
    __table_args__ = (Index("ix_notif_scheduled", "scheduled_at", "sent_at"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    appointment_id: Mapped[str] = mapped_column(ForeignKey("appointments.id"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    channel: Mapped[str] = mapped_column(String(16), default=NotificationChannel.EMAIL.value)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)


class PaymentAttempt(Base):
    __tablename__ = "payment_attempts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    appointment_id: Mapped[str] = mapped_column(ForeignKey("appointments.id"), index=True)
    provider: Mapped[str] = mapped_column(String(32))  # stripe, mercadopago
    amount_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(8), default="CLP")
    status: Mapped[str] = mapped_column(String(32), default=PaymentAttemptStatus.PENDING.value)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)


class AppointmentReview(Base):
    """Calificación del cliente tras la cita (una por cita). Alimenta promedios de tienda y profesional."""

    __tablename__ = "appointment_reviews"
    __table_args__ = (
        UniqueConstraint("appointment_id", name="uq_appointment_review_appt"),
        Index("ix_appt_review_store", "store_id"),
        Index("ix_appt_review_professional", "professional_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    appointment_id: Mapped[str] = mapped_column(ForeignKey("appointments.id"), nullable=False)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    professional_id: Mapped[str] = mapped_column(ForeignKey("professionals.id"), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class WaitlistEntry(Base):
    """Cliente en lista de espera para un slot específico de profesional+servicio+fecha."""
    __tablename__ = "waitlist_entries"
    __table_args__ = (Index("ix_waitlist_prof_svc_date", "professional_id", "service_id", "desired_date"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"), index=True)
    professional_id: Mapped[str] = mapped_column(ForeignKey("professionals.id"), index=True)
    service_id: Mapped[str] = mapped_column(ForeignKey("scheduling_services.id"), index=True)
    # Cliente puede o no estar registrado
    client_id: Mapped[str | None] = mapped_column(ForeignKey("clients.id"), nullable=True, index=True)
    client_name: Mapped[str] = mapped_column(String(200))
    client_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    desired_date: Mapped[date] = mapped_column(Date, index=True)
    # Estado: waiting, notified, booked, expired
    status: Mapped[str] = mapped_column(String(32), default="waiting", index=True)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
