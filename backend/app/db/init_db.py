import asyncio
from app.core.database import engine, Base
from app.models import User, UserRole, StoreType, Store, StoreMember
from app.models.scheduling import (
    Branch,
    Professional,
    ProfessionalBranch,
    Service as SchedulingService,
    ProfessionalService,
    AvailabilityRule,
    AvailabilityRuleType,
    WaitlistEntry,  # noqa: F401 — registra tabla en metadata
)
from app.models.client_document import ClientDocument  # noqa: F401 — registro en metadata
from app.models.store import StoreMemberRole
from app.core.security import get_password_hash
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text
from datetime import time

from app.core.config import settings

DEFAULT_SETTINGS = {
    "ai": {"business_context": "", "tone": "professional"},
    "stock": {"replenishment_buffer_days": 2},
    "agenda": {"default_duration_minutes": 30, "reminder_hours_before": 24},
}


async def _migrate_permissions_column_and_userrole_client():
    if "postgresql" in settings.DATABASE_URL:
        async with engine.begin() as conn:
            await conn.execute(
                text("ALTER TABLE store_members ADD COLUMN IF NOT EXISTS permissions JSONB;")
            )
        try:
            async with engine.begin() as conn:
                await conn.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'client';"))
        except Exception as e:
            print("Aviso migración userrole (client):", e)
    elif "sqlite" in settings.DATABASE_URL:
        try:
            async with engine.begin() as conn:
                await conn.execute(text("ALTER TABLE store_members ADD COLUMN permissions JSON;"))
        except Exception as e:
            print("Aviso migración store_members.permissions (sqlite):", e)


async def _migrate_meeting_confirmation_columns():
    if "postgresql" not in settings.DATABASE_URL:
        return
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "ALTER TABLE meetings ADD COLUMN IF NOT EXISTS confirmation_token VARCHAR(64);"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE meetings ADD COLUMN IF NOT EXISTS confirmation_status VARCHAR(32) DEFAULT 'scheduled';"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE meetings ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP;"
            )
        )
        await conn.execute(
            text(
                """UPDATE meetings SET confirmation_token = md5(random()::text || id::text)
                   WHERE confirmation_token IS NULL OR trim(confirmation_token) = '';"""
            )
        )


_PG_FIRST_STORE = "(SELECT id FROM stores ORDER BY created_at ASC NULLS LAST LIMIT 1)"


async def _migrate_legacy_store_id_columns_postgresql():
    """Bases antiguas sin store_id en clients/tickets/products/etc. Debe ejecutarse antes de meetings."""
    if "postgresql" not in settings.DATABASE_URL:
        return

    async def _add_col(table: str) -> None:
        try:
            async with engine.begin() as conn:
                await conn.execute(
                    text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS store_id VARCHAR;")
                )
        except Exception as e:
            print(f"Aviso migración {table}.store_id ADD:", e)

    await _add_col("clients")
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    f"UPDATE clients SET store_id = {_PG_FIRST_STORE} WHERE store_id IS NULL"
                )
            )
    except Exception as e:
        print("Aviso clients.store_id backfill:", e)

    await _add_col("tickets")
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    UPDATE tickets t
                    SET store_id = c.store_id
                    FROM clients c
                    WHERE t.store_id IS NULL AND t.client_id IS NOT NULL AND c.id = t.client_id
                    """
                )
            )
    except Exception as e:
        print("Aviso tickets.store_id desde clients:", e)
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    f"UPDATE tickets SET store_id = {_PG_FIRST_STORE} WHERE store_id IS NULL"
                )
            )
    except Exception as e:
        print("Aviso tickets.store_id fallback:", e)

    await _add_col("products")
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    f"UPDATE products SET store_id = {_PG_FIRST_STORE} WHERE store_id IS NULL"
                )
            )
    except Exception as e:
        print("Aviso products.store_id backfill:", e)

    await _add_col("purchases")
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    UPDATE purchases p
                    SET store_id = pr.store_id
                    FROM products pr
                    WHERE p.store_id IS NULL AND p.product_id = pr.id
                    """
                )
            )
    except Exception as e:
        print("Aviso purchases.store_id desde products:", e)
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    UPDATE purchases p
                    SET store_id = c.store_id
                    FROM clients c
                    WHERE p.store_id IS NULL AND p.client_id = c.id
                    """
                )
            )
    except Exception as e:
        print("Aviso purchases.store_id desde clients:", e)
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    f"UPDATE purchases SET store_id = {_PG_FIRST_STORE} WHERE store_id IS NULL"
                )
            )
    except Exception as e:
        print("Aviso purchases.store_id fallback:", e)

    await _add_col("form_links")
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    UPDATE form_links f
                    SET store_id = c.store_id
                    FROM clients c
                    WHERE f.store_id IS NULL AND f.client_id IS NOT NULL AND c.id = f.client_id
                    """
                )
            )
    except Exception as e:
        print("Aviso form_links.store_id desde clients:", e)
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    f"UPDATE form_links SET store_id = {_PG_FIRST_STORE} WHERE store_id IS NULL"
                )
            )
    except Exception as e:
        print("Aviso form_links.store_id fallback:", e)

    await _add_col("client_documents")
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    UPDATE client_documents d
                    SET store_id = c.store_id
                    FROM clients c
                    WHERE d.store_id IS NULL AND d.client_id = c.id
                    """
                )
            )
    except Exception as e:
        print("Aviso client_documents.store_id desde clients:", e)
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    f"UPDATE client_documents SET store_id = {_PG_FIRST_STORE} WHERE store_id IS NULL"
                )
            )
    except Exception as e:
        print("Aviso client_documents.store_id fallback:", e)


async def _migrate_meetings_store_id():
    """Bases antiguas: la tabla meetings no tenía store_id; el modelo y el worker lo requieren.
    Cada paso en su propia transacción para que un fallo en UPDATE no revierta el ALTER TABLE."""
    if "postgresql" not in settings.DATABASE_URL:
        return
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS store_id VARCHAR;"))
    except Exception as e:
        print("Aviso meetings ADD store_id:", e)
        return

    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    UPDATE meetings m
                    SET store_id = c.store_id
                    FROM clients c
                    WHERE m.store_id IS NULL AND m.client_id IS NOT NULL AND c.id = m.client_id
                    """
                )
            )
    except Exception as e:
        print("Aviso migración meetings.store_id desde clients:", e)

    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    f"""
                    UPDATE meetings
                    SET store_id = {_PG_FIRST_STORE}
                    WHERE store_id IS NULL
                    """
                )
            )
    except Exception as e:
        print("Aviso migración meetings.store_id fallback stores:", e)

    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_meetings_store_id ON meetings (store_id);"))
    except Exception as e:
        print("Aviso ix_meetings_store_id:", e)
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE meetings ALTER COLUMN store_id SET NOT NULL"))
    except Exception as e:
        print("Aviso meetings.store_id NOT NULL:", e)
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "ALTER TABLE meetings ADD CONSTRAINT meetings_store_id_fkey "
                    "FOREIGN KEY (store_id) REFERENCES stores (id)"
                )
            )
    except Exception as e:
        print("Aviso meetings.store_id FK:", e)


def _s(ctx: str, duration: int = 30) -> dict:
    """Helper para construir default_settings con contexto IA y duración de cita."""
    return {
        **DEFAULT_SETTINGS,
        "agenda": {**DEFAULT_SETTINGS["agenda"], "default_duration_minutes": duration},
        "ai": {**DEFAULT_SETTINGS["ai"], "business_context": ctx},
    }


STORE_TYPE_SEEDS = [
    # ── Comercio ───────────────────────────────────────────────────────────────
    {
        "name": "Comercio minorista",
        "slug": "retail",
        "description": "Tienda física u online con catálogo y stock.",
        "icon": "shopping-bag",
        "default_settings": _s("Venta de productos con inventario y posible envío. Gestión de stock, ventas y clientes."),
    },
    {
        "name": "Mayorista / distribuidor",
        "slug": "wholesale",
        "description": "Venta al por mayor, pedidos B2B y gestión de inventario masivo.",
        "icon": "warehouse",
        "default_settings": _s("Distribución y venta mayorista. Pedidos B2B, gestión de stock masivo y clientes empresariales."),
    },
    # ── Gastronomía ────────────────────────────────────────────────────────────
    {
        "name": "Restaurante / delivery",
        "slug": "food",
        "description": "Pedidos, incidencias y relación con clientes.",
        "icon": "utensils",
        "default_settings": _s("Restaurante u operación de comida: pedidos, reservas de mesa y reclamos."),
    },
    {
        "name": "Cafetería / pastelería",
        "slug": "cafe",
        "description": "Atención de local, delivery y productos artesanales.",
        "icon": "coffee",
        "default_settings": _s("Cafetería o pastelería: productos del día, reservas de mesa y pedidos online."),
    },
    {
        "name": "Catering y eventos gastronómicos",
        "slug": "catering",
        "description": "Cotizaciones, menús y coordinación de eventos de comida.",
        "icon": "chef-hat",
        "default_settings": _s("Catering para eventos: cotizaciones de menú, coordinación logística y seguimiento de clientes.", 60),
    },
    # ── Salud y bienestar ──────────────────────────────────────────────────────
    {
        "name": "Salud y belleza",
        "slug": "beauty",
        "description": "Agenda de citas, fichas de clientes y consumibles.",
        "icon": "sparkles",
        "default_settings": _s("Salón, clínica estética o spa: citas, historial y productos de uso frecuente.", 45),
    },
    {
        "name": "Peluquería / barbería",
        "slug": "barbershop",
        "description": "Citas de corte y color, control de productos y fidelización.",
        "icon": "scissors",
        "default_settings": _s("Peluquería o barbería: citas de corte, coloración y tratamientos. Control de consumibles y clientes recurrentes.", 40),
    },
    {
        "name": "Odontología / clínica dental",
        "slug": "dental",
        "description": "Agenda de tratamientos, fichas clínicas y presupuestos.",
        "icon": "tooth",
        "default_settings": _s("Clínica dental: agenda de tratamientos (limpiezas, ortodoncia, implantes), fichas del paciente y presupuestos.", 60),
    },
    {
        "name": "Psicología / salud mental",
        "slug": "psychology",
        "description": "Sesiones de terapia, seguimiento de pacientes y notas clínicas.",
        "icon": "brain",
        "default_settings": _s("Consulta de psicología o terapia: sesiones individuales, seguimiento del paciente y coordinación de horarios.", 50),
    },
    {
        "name": "Kinesiología / fisioterapia",
        "slug": "physiotherapy",
        "description": "Rehabilitación, evaluaciones y control de progreso.",
        "icon": "activity",
        "default_settings": _s("Centro de kinesiología: sesiones de rehabilitación, evaluaciones iniciales y seguimiento del progreso del paciente.", 45),
    },
    {
        "name": "Nutrición / dietética",
        "slug": "nutrition",
        "description": "Consultas, planes alimenticios y control de evolución.",
        "icon": "apple",
        "default_settings": _s("Consulta de nutrición: evaluaciones, planes alimenticios personalizados y seguimiento de peso/evolución.", 45),
    },
    # ── Fitness y deporte ──────────────────────────────────────────────────────
    {
        "name": "Gimnasio y fitness",
        "slug": "fitness",
        "description": "Membresías, clases grupales y entrenamiento personal.",
        "icon": "dumbbell",
        "default_settings": _s("Gimnasio o centro de fitness: membresías, clases grupales (yoga, pilates, spinning), entrenamiento personal y control de asistencia.", 60),
    },
    {
        "name": "Entrenador personal",
        "slug": "personal-trainer",
        "description": "Sesiones de entrenamiento, planes y seguimiento de progreso.",
        "icon": "zap",
        "default_settings": _s("Entrenador personal: sesiones de entrenamiento a domicilio o en gimnasio, planes de ejercicio y seguimiento de resultados.", 60),
    },
    # ── Educación ──────────────────────────────────────────────────────────────
    {
        "name": "Educación y clases particulares",
        "slug": "education",
        "description": "Clases, talleres y academia de idiomas o habilidades.",
        "icon": "graduation-cap",
        "default_settings": _s("Academia o clases particulares: agenda de sesiones, seguimiento del alumno, cobranza mensual y material de apoyo.", 60),
    },
    {
        "name": "Centro de idiomas",
        "slug": "languages",
        "description": "Cursos de idiomas, niveles y seguimiento de alumnos.",
        "icon": "languages",
        "default_settings": _s("Centro de idiomas: cursos presenciales u online, niveles (A1–C2), matrícula, seguimiento de progreso y certificaciones.", 60),
    },
    # ── Servicios profesionales ────────────────────────────────────────────────
    {
        "name": "Servicios y consultoría",
        "slug": "services",
        "description": "Citas, proyectos y seguimiento de clientes B2B.",
        "icon": "briefcase",
        "default_settings": _s("Prestación de servicios profesionales: propuestas, proyectos, reuniones y seguimiento de clientes B2B."),
    },
    {
        "name": "Abogados / estudio jurídico",
        "slug": "legal",
        "description": "Gestión de casos, clientes y citas de asesoría legal.",
        "icon": "scale",
        "default_settings": _s("Estudio jurídico: agenda de consultas, seguimiento de casos, gestión de clientes y plazos legales.", 45),
    },
    {
        "name": "Contabilidad / finanzas",
        "slug": "accounting",
        "description": "Gestión de clientes contables, plazos y documentos.",
        "icon": "calculator",
        "default_settings": _s("Estudio contable o financiero: gestión de clientes, plazos tributarios, declaraciones y reuniones de asesoría.", 45),
    },
    {
        "name": "Arquitectura / diseño",
        "slug": "architecture",
        "description": "Proyectos, presupuestos y reuniones con clientes.",
        "icon": "pen-tool",
        "default_settings": _s("Estudio de arquitectura o diseño: proyectos, reuniones de avance, cotizaciones y seguimiento con clientes.", 60),
    },
    {
        "name": "Marketing / agencia digital",
        "slug": "marketing",
        "description": "Clientes, campañas, reuniones y reportes.",
        "icon": "trending-up",
        "default_settings": _s("Agencia de marketing o publicidad: gestión de clientes, campañas digitales, reportes mensuales y reuniones de avance."),
    },
    # ── Hogar y servicios técnicos ─────────────────────────────────────────────
    {
        "name": "Servicios del hogar",
        "slug": "home-services",
        "description": "Electricidad, gasfitería, climatización y reparaciones.",
        "icon": "tool",
        "default_settings": _s("Servicios del hogar: electricidad, gasfitería, pintura, plomería. Gestión de visitas técnicas, presupuestos y cobros."),
    },
    {
        "name": "Taller mecánico / automotriz",
        "slug": "automotive",
        "description": "Recepción de vehículos, presupuestos y seguimiento de reparaciones.",
        "icon": "car",
        "default_settings": _s("Taller mecánico: recepción de vehículos, diagnóstico, presupuestos, seguimiento de reparación y entrega.", 60),
    },
    {
        "name": "Taller de tecnología / electrónica",
        "slug": "tech-repair",
        "description": "Reparación de dispositivos, seguimiento de órdenes y garantías.",
        "icon": "smartphone",
        "default_settings": _s("Taller de reparación de celulares, computadores y electrónica: órdenes de trabajo, diagnóstico, presupuesto y entrega."),
    },
    # ── Inmobiliaria y viajes ──────────────────────────────────────────────────
    {
        "name": "Inmobiliaria",
        "slug": "real-estate",
        "description": "Propiedades, visitas y seguimiento de clientes compradores/arrendatarios.",
        "icon": "home",
        "default_settings": _s("Inmobiliaria: gestión de propiedades en venta y arriendo, agenda de visitas, seguimiento de clientes y cierre de negocios.", 45),
    },
    {
        "name": "Agencia de viajes",
        "slug": "travel",
        "description": "Cotizaciones, reservas y seguimiento de viajeros.",
        "icon": "plane",
        "default_settings": _s("Agencia de viajes: cotizaciones de paquetes, reservas de vuelos y hoteles, seguimiento de clientes y post-venta.", 30),
    },
    # ── Mascotas ───────────────────────────────────────────────────────────────
    {
        "name": "Veterinaria",
        "slug": "veterinary",
        "description": "Citas, fichas de mascotas y control de productos veterinarios.",
        "icon": "heart",
        "default_settings": _s("Clínica veterinaria: citas médicas, fichas de mascotas (historial, vacunas, peso), cirugías y control de medicamentos.", 30),
    },
    {
        "name": "Peluquería canina / grooming",
        "slug": "grooming",
        "description": "Baño, corte y cuidado de mascotas por cita.",
        "icon": "scissors",
        "default_settings": _s("Servicio de grooming o peluquería canina: citas de baño y corte, ficha de la mascota y recordatorios al dueño.", 60),
    },
    # ── Fotografía y creativos ─────────────────────────────────────────────────
    {
        "name": "Fotografía / videografía",
        "slug": "photography",
        "description": "Sesiones fotográficas, eventos y entrega de material.",
        "icon": "camera",
        "default_settings": _s("Estudio fotográfico o videografía: sesiones fotográficas, cobertura de eventos, cotizaciones y entrega de material editado.", 90),
    },
    {
        "name": "Eventos y producción",
        "slug": "events",
        "description": "Coordinación de eventos, proveedores y logística.",
        "icon": "party-popper",
        "default_settings": _s("Empresa de eventos: cotizaciones, coordinación de proveedores (sonido, catering, decoración), seguimiento y post-evento.", 60),
    },
    # ── Genérico ───────────────────────────────────────────────────────────────
    {
        "name": "Genérico",
        "slug": "generic",
        "description": "Plantilla neutra adaptable a cualquier negocio.",
        "icon": "layout-grid",
        "default_settings": DEFAULT_SETTINGS,
    },
]

async def _migrate_agenda_features():
    """Nuevas columnas de agenda: política cancelación, depósito, re-agendamiento, intake, descripción."""
    if "postgresql" not in settings.DATABASE_URL:
        return
    stmts = [
        "ALTER TABLE scheduling_services ADD COLUMN IF NOT EXISTS description TEXT;",
        "ALTER TABLE scheduling_services ADD COLUMN IF NOT EXISTS cancellation_hours INTEGER DEFAULT 24;",
        "ALTER TABLE scheduling_services ADD COLUMN IF NOT EXISTS cancellation_fee_cents INTEGER DEFAULT 0;",
        "ALTER TABLE scheduling_services ADD COLUMN IF NOT EXISTS deposit_required_cents INTEGER DEFAULT 0;",
        "ALTER TABLE scheduling_services ADD COLUMN IF NOT EXISTS suggest_rebooking_days INTEGER DEFAULT 0;",
        "ALTER TABLE scheduling_services ADD COLUMN IF NOT EXISTS intake_form_schema JSONB;",
    ]
    for sql in stmts:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(sql))
        except Exception as e:
            print(f"Aviso migración agenda_features ({sql[:60]}…):", e)
    # Tabla de lista de espera — se crea vía create_all, pero aseguramos el índice
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_waitlist_prof_svc_date "
                    "ON waitlist_entries (professional_id, service_id, desired_date);"
                )
            )
    except Exception as e:
        print("Aviso índice waitlist:", e)


async def _migrate_service_menu_category():
    """Categorías y orden en el menú de servicios (estilo catálogo por rubro)."""
    if "postgresql" not in settings.DATABASE_URL:
        return
    stmts = [
        "ALTER TABLE scheduling_services ADD COLUMN IF NOT EXISTS category VARCHAR(120);",
        "ALTER TABLE scheduling_services ADD COLUMN IF NOT EXISTS menu_sort_order INTEGER DEFAULT 0;",
    ]
    for sql in stmts:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(sql))
        except Exception as e:
            print(f"Aviso migración service_menu_category ({sql[:50]}…):", e)


async def _migrate_scheduling_operations_extensions():
    """Servicio → producto; cita → ticket y precio cobrado (panel atención / operaciones)."""
    if "postgresql" not in settings.DATABASE_URL:
        return
    stmts = [
        "ALTER TABLE scheduling_services ADD COLUMN IF NOT EXISTS product_id VARCHAR;",
        "ALTER TABLE scheduling_services ADD COLUMN IF NOT EXISTS allow_price_override BOOLEAN DEFAULT true;",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ticket_id VARCHAR;",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS charged_price_cents INTEGER;",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS session_closed_at TIMESTAMP;",
    ]
    for sql in stmts:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(sql))
        except Exception as e:
            print(f"Aviso migración scheduling ops ({sql[:50]}…):", e)
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    ALTER TABLE scheduling_services
                    ADD CONSTRAINT scheduling_services_product_id_fkey
                    FOREIGN KEY (product_id) REFERENCES products(id)
                    """
                )
            )
    except Exception as e:
        print("Aviso FK scheduling_services.product_id (puede existir):", e)
    for idx_sql in (
        "CREATE INDEX IF NOT EXISTS ix_appt_store_status_end ON appointments (store_id, status, end_time);",
        "CREATE INDEX IF NOT EXISTS ix_appt_store_start_status ON appointments (store_id, start_time, status);",
    ):
        try:
            async with engine.begin() as conn:
                await conn.execute(text(idx_sql))
        except Exception as e:
            print(f"Aviso índice panel citas ({idx_sql[:40]}…):", e)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        await _migrate_service_menu_category()
    except Exception as e:
        print("Aviso migración service menu category:", e)
    try:
        await _migrate_scheduling_operations_extensions()
    except Exception as e:
        print("Aviso migración scheduling operations:", e)
    try:
        await _migrate_agenda_features()
    except Exception as e:
        print("Aviso migración agenda features:", e)
    try:
        await _migrate_permissions_column_and_userrole_client()
    except Exception as e:
        print("Aviso migración permisos/userrole:", e)
    try:
        await _migrate_meeting_confirmation_columns()
    except Exception as e:
        print("Aviso migración meetings:", e)
    try:
        await _migrate_legacy_store_id_columns_postgresql()
    except Exception as e:
        print("Aviso migración legacy store_id:", e)
    try:
        await _migrate_meetings_store_id()
    except Exception as e:
        print("Aviso migración meetings.store_id:", e)

    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        for spec in STORE_TYPE_SEEDS:
            r = await session.execute(select(StoreType).where(StoreType.slug == spec["slug"]))
            if r.scalar_one_or_none() is None:
                session.add(
                    StoreType(
                        name=spec["name"],
                        slug=spec["slug"],
                        description=spec["description"],
                        icon=spec["icon"],
                        default_settings=spec["default_settings"],
                    )
                )
        await session.commit()

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == "admin@revotake.com"))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                email="admin@revotake.com",
                name="Admin RevoTake",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.ADMIN,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            print("Admin user created: admin@revotake.com / admin123")
        tr = await session.execute(select(StoreType).where(StoreType.slug == "generic"))
        st = tr.scalar_one_or_none()
        if not st:
            print("No generic store type; run seeds first")
            return
        sr = await session.execute(select(Store).where(Store.slug == "mi-tienda-demo"))
        store = sr.scalar_one_or_none()
        if not store:
            store = Store(
                name="Mi tienda (demo)",
                slug="mi-tienda-demo",
                store_type_id=st.id,
                settings=dict(st.default_settings or {}),
            )
            session.add(store)
            await session.commit()
            await session.refresh(store)
            print("Demo store created:", store.id)
        mr = await session.execute(
            select(StoreMember).where(StoreMember.user_id == user.id, StoreMember.store_id == store.id)
        )
        if mr.scalar_one_or_none() is None:
            session.add(StoreMember(user_id=user.id, store_id=store.id, role=StoreMemberRole.ADMIN))
            await session.commit()
            print("Admin linked to demo store")

        br = await session.execute(select(Branch).where(Branch.store_id == store.id, Branch.slug == "sede-central"))
        branch = br.scalar_one_or_none()
        if not branch:
            branch = Branch(
                store_id=store.id,
                name="Sede central",
                slug="sede-central",
                timezone="UTC",
            )
            session.add(branch)
            await session.flush()
            prof = Professional(store_id=store.id, name="Profesional demo", email="demo@revotake.com")
            session.add(prof)
            await session.flush()
            session.add(ProfessionalBranch(professional_id=prof.id, branch_id=branch.id, is_primary=True))
            svc = SchedulingService(
                store_id=store.id,
                name="Consulta general",
                slug="consulta-general",
                duration_minutes=30,
                buffer_before_minutes=0,
                buffer_after_minutes=0,
                price_cents=15000,
                currency="CLP",
            )
            session.add(svc)
            await session.flush()
            session.add(ProfessionalService(professional_id=prof.id, service_id=svc.id))
            for wd in range(0, 5):
                session.add(
                    AvailabilityRule(
                        professional_id=prof.id,
                        branch_id=branch.id,
                        rule_type=AvailabilityRuleType.WEEKLY.value,
                        weekday=wd,
                        start_time=time(9, 0),
                        end_time=time(18, 0),
                        is_closed=False,
                    )
                )
            await session.commit()
            print("Scheduling demo: branch, professional, service, availability seeded")

        # Vincular profesional demo al admin para probar "Mi agenda"
        pr_link = await session.execute(
            select(Professional).where(Professional.store_id == store.id, Professional.name == "Profesional demo")
        )
        prof_demo = pr_link.scalar_one_or_none()
        if prof_demo and not prof_demo.user_id:
            prof_demo.user_id = user.id
            await session.commit()
            print("Profesional demo vinculado al usuario admin (Mi agenda)")

if __name__ == "__main__":
    asyncio.run(init_db())
