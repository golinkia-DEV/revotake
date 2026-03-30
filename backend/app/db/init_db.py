import asyncio
from app.core.database import engine, Base
from app.models import User, UserRole, StoreType, Store, StoreMember, Product, ProductBranchStock
from app.models.scheduling import (
    Branch,
    Professional,
    ProfessionalBranch,
    Service as SchedulingService,
    ProfessionalService,
    AvailabilityRule,
    AvailabilityRuleType,
    WaitlistEntry,  # noqa: F401 — registra tabla en metadata
    AppointmentReview,  # noqa: F401 — registra tabla en metadata
)
from app.models.client_document import ClientDocument  # noqa: F401 — registro en metadata
from app.models.store import StoreMemberRole
from app.core.security import get_password_hash
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import func, select, text
from datetime import time

from app.core.config import settings
from app.db.store_type_seeds import store_type_seeds_for_wellness
from app.services.work_stations import seed_work_stations_from_store_settings

DEFAULT_SETTINGS = {
    "ai": {"business_context": "", "tone": "professional"},
    "stock": {"replenishment_buffer_days": 2},
    "agenda": {"default_duration_minutes": 30, "reminder_hours_before": 24},
    "local_structure": {"chair_count": 0, "room_count": 0},
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


async def _migrate_professional_invite_and_commissions():
    """Teléfono, invitación por correo, comisiones por servicio y % productos."""
    if "postgresql" in settings.DATABASE_URL:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE professionals ADD COLUMN IF NOT EXISTS phone VARCHAR(40);"))
            await conn.execute(text("ALTER TABLE professionals ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64);"))
            await conn.execute(text("ALTER TABLE professionals ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP;"))
            await conn.execute(
                text("ALTER TABLE professionals ADD COLUMN IF NOT EXISTS product_commission_percent DOUBLE PRECISION;")
            )
            await conn.execute(
                text(
                    "ALTER TABLE professional_services ADD COLUMN IF NOT EXISTS commission_percent DOUBLE PRECISION;"
                )
            )
        try:
            async with engine.begin() as conn:
                await conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_professionals_invite_token "
                        "ON professionals (invite_token) WHERE invite_token IS NOT NULL;"
                    )
                )
        except Exception as e:
            print("Aviso índice invite_token professionals:", e)
    elif "sqlite" in settings.DATABASE_URL:
        for stmt in (
            "ALTER TABLE professionals ADD COLUMN phone VARCHAR(40);",
            "ALTER TABLE professionals ADD COLUMN invite_token VARCHAR(64);",
            "ALTER TABLE professionals ADD COLUMN invite_expires_at TIMESTAMP;",
            "ALTER TABLE professionals ADD COLUMN product_commission_percent FLOAT;",
            "ALTER TABLE professional_services ADD COLUMN commission_percent FLOAT;",
        ):
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(stmt))
            except Exception:
                pass


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
                    """
                    DO $body$
                    BEGIN
                      IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint c
                        JOIN pg_class t ON t.oid = c.conrelid
                        JOIN pg_namespace n ON n.oid = t.relnamespace
                        WHERE n.nspname = 'public' AND t.relname = 'meetings'
                          AND c.conname = 'meetings_store_id_fkey'
                      ) THEN
                        ALTER TABLE meetings ADD CONSTRAINT meetings_store_id_fkey
                        FOREIGN KEY (store_id) REFERENCES stores (id);
                      END IF;
                    END
                    $body$;
                    """
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


STORE_TYPE_SEEDS = store_type_seeds_for_wellness(_s)

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


async def _migrate_service_images():
    """Galería de imágenes por servicio (JSON array de URLs)."""
    if "postgresql" not in settings.DATABASE_URL:
        return
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "ALTER TABLE scheduling_services ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;"
                )
            )
    except Exception as e:
        print("Aviso migración service_images:", e)


async def _migrate_branch_location_chile():
    """Sedes: región, comuna, dirección y zona horaria por defecto Chile."""
    if "postgresql" in settings.DATABASE_URL:
        stmts = [
            "ALTER TABLE branches ADD COLUMN IF NOT EXISTS region VARCHAR(200);",
            "ALTER TABLE branches ADD COLUMN IF NOT EXISTS comuna VARCHAR(120);",
            "ALTER TABLE branches ADD COLUMN IF NOT EXISTS address_line TEXT;",
        ]
        for sql in stmts:
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(sql))
            except Exception as e:
                print(f"Aviso migración branch_location ({sql[:50]}…):", e)
    elif "sqlite" in settings.DATABASE_URL:
        for col, typ in (
            ("region", "VARCHAR(200)"),
            ("comuna", "VARCHAR(120)"),
            ("address_line", "TEXT"),
        ):
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(f"ALTER TABLE branches ADD COLUMN {col} {typ};"))
            except Exception as e:
                print(f"Aviso sqlite branches.{col}:", e)


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
                    DO $body$
                    BEGIN
                      IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint c
                        JOIN pg_class t ON t.oid = c.conrelid
                        JOIN pg_namespace n ON n.oid = t.relnamespace
                        WHERE n.nspname = 'public' AND t.relname = 'scheduling_services'
                          AND c.conname = 'scheduling_services_product_id_fkey'
                      ) THEN
                        ALTER TABLE scheduling_services
                        ADD CONSTRAINT scheduling_services_product_id_fkey
                        FOREIGN KEY (product_id) REFERENCES products(id);
                      END IF;
                    END
                    $body$;
                    """
                )
            )
    except Exception as e:
        print("Aviso FK scheduling_services.product_id:", e)
    for idx_sql in (
        "CREATE INDEX IF NOT EXISTS ix_appt_store_status_end ON appointments (store_id, status, end_time);",
        "CREATE INDEX IF NOT EXISTS ix_appt_store_start_status ON appointments (store_id, start_time, status);",
    ):
        try:
            async with engine.begin() as conn:
                await conn.execute(text(idx_sql))
        except Exception as e:
            print(f"Aviso índice panel citas ({idx_sql[:40]}…):", e)


async def _migrate_work_stations():
    """Sillones/salas por sede y vínculo profesional–puesto."""
    if "postgresql" in settings.DATABASE_URL:
        stmts = [
            """
            CREATE TABLE IF NOT EXISTS work_stations (
                id VARCHAR NOT NULL PRIMARY KEY,
                store_id VARCHAR NOT NULL REFERENCES stores(id),
                branch_id VARCHAR NOT NULL REFERENCES branches(id),
                name VARCHAR(200) NOT NULL,
                kind VARCHAR(32) NOT NULL DEFAULT 'chair',
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
            );
            """,
            "CREATE INDEX IF NOT EXISTS ix_work_stations_store ON work_stations (store_id);",
            "CREATE INDEX IF NOT EXISTS ix_work_stations_branch ON work_stations (branch_id);",
            "CREATE INDEX IF NOT EXISTS ix_work_stations_branch_active ON work_stations (branch_id, is_active);",
            "ALTER TABLE professional_branches ADD COLUMN IF NOT EXISTS station_mode VARCHAR(16) DEFAULT 'none';",
            "ALTER TABLE professional_branches ADD COLUMN IF NOT EXISTS default_station_id VARCHAR;",
            "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS station_id VARCHAR;",
        ]
        for sql in stmts:
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(sql))
            except Exception as e:
                print(f"Aviso migración work_stations ({sql[:50]}…):", e)
        for fk_sql in (
            """DO $body$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'professional_branches_default_station_id_fkey'
              ) THEN
                ALTER TABLE professional_branches
                ADD CONSTRAINT professional_branches_default_station_id_fkey
                FOREIGN KEY (default_station_id) REFERENCES work_stations(id);
              END IF;
            END $body$ LANGUAGE plpgsql;""",
            """DO $body$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'appointments_station_id_fkey'
              ) THEN
                ALTER TABLE appointments
                ADD CONSTRAINT appointments_station_id_fkey
                FOREIGN KEY (station_id) REFERENCES work_stations(id);
              END IF;
            END $body$ LANGUAGE plpgsql;""",
        ):
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(fk_sql))
            except Exception as e:
                print("Aviso FK work_stations:", e)
        for idx_sql in (
            "CREATE INDEX IF NOT EXISTS ix_prof_branch_default_station ON professional_branches (default_station_id);",
            "CREATE INDEX IF NOT EXISTS ix_appointments_station ON appointments (station_id);",
        ):
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(idx_sql))
            except Exception as e:
                print(f"Aviso índice work_stations ({idx_sql[:40]}…):", e)
    elif "sqlite" in settings.DATABASE_URL:
        try:
            async with engine.begin() as conn:
                await conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS work_stations (
                            id VARCHAR NOT NULL PRIMARY KEY,
                            store_id VARCHAR NOT NULL REFERENCES stores(id),
                            branch_id VARCHAR NOT NULL REFERENCES branches(id),
                            name VARCHAR(200) NOT NULL,
                            kind VARCHAR(32) NOT NULL DEFAULT 'chair',
                            sort_order INTEGER NOT NULL DEFAULT 0,
                            is_active BOOLEAN NOT NULL DEFAULT 1,
                            created_at TIMESTAMP
                        );
                        """
                    )
                )
        except Exception as e:
            print("Aviso sqlite work_stations table:", e)
        for stmt in (
            "ALTER TABLE professional_branches ADD COLUMN station_mode VARCHAR(16) DEFAULT 'none';",
            "ALTER TABLE professional_branches ADD COLUMN default_station_id VARCHAR;",
            "ALTER TABLE appointments ADD COLUMN station_id VARCHAR;",
        ):
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(stmt))
            except Exception:
                pass


async def _migrate_product_branch_stock():
    """Stock por sede y sede en compras."""
    if "postgresql" in settings.DATABASE_URL:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS product_branch_stocks (
                        id VARCHAR NOT NULL PRIMARY KEY,
                        product_id VARCHAR NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                        branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                        quantity INTEGER NOT NULL DEFAULT 0,
                        lead_time_days INTEGER,
                        created_at TIMESTAMP,
                        CONSTRAINT uq_product_branch_stock UNIQUE (product_id, branch_id)
                    );
                    """
                )
            )
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_pbs_product ON product_branch_stocks (product_id);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_pbs_branch ON product_branch_stocks (branch_id);"))
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE purchases ADD COLUMN IF NOT EXISTS branch_id VARCHAR;"))
        try:
            async with engine.begin() as conn:
                await conn.execute(
                    text(
                        """
                        DO $body$
                        BEGIN
                          IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint WHERE conname = 'purchases_branch_id_fkey'
                          ) THEN
                            ALTER TABLE purchases
                            ADD CONSTRAINT purchases_branch_id_fkey
                            FOREIGN KEY (branch_id) REFERENCES branches(id);
                          END IF;
                        END $body$ LANGUAGE plpgsql;
                        """
                    )
                )
        except Exception as e:
            print("Aviso FK purchases.branch_id:", e)
        try:
            async with engine.begin() as conn:
                await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_purchases_branch ON purchases (branch_id);"))
        except Exception as e:
            print("Aviso índice purchases.branch_id:", e)
    elif "sqlite" in settings.DATABASE_URL:
        try:
            async with engine.begin() as conn:
                await conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS product_branch_stocks (
                            id VARCHAR NOT NULL PRIMARY KEY,
                            product_id VARCHAR NOT NULL REFERENCES products(id),
                            branch_id VARCHAR NOT NULL REFERENCES branches(id),
                            quantity INTEGER NOT NULL DEFAULT 0,
                            lead_time_days INTEGER,
                            created_at TIMESTAMP,
                            UNIQUE (product_id, branch_id)
                        );
                        """
                    )
                )
        except Exception as e:
            print("Aviso sqlite product_branch_stocks:", e)
        try:
            async with engine.begin() as conn:
                await conn.execute(text("ALTER TABLE purchases ADD COLUMN branch_id VARCHAR REFERENCES branches(id);"))
        except Exception:
            pass


async def _backfill_product_branch_stocks():
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        pr = await session.execute(select(Product.id, Product.store_id, Product.stock))
        for pid, sid, stock_val in pr.all():
            cnt = await session.execute(
                select(func.count()).select_from(ProductBranchStock).where(ProductBranchStock.product_id == pid)
            )
            if (cnt.scalar() or 0) > 0:
                continue
            br = await session.execute(
                select(Branch)
                .where(Branch.store_id == sid, Branch.is_active.is_(True))
                .order_by(Branch.created_at)
            )
            branches = list(br.scalars().all())
            if not branches:
                continue
            q0 = int(stock_val or 0)
            session.add(ProductBranchStock(product_id=pid, branch_id=branches[0].id, quantity=q0))
            for b in branches[1:]:
                session.add(ProductBranchStock(product_id=pid, branch_id=b.id, quantity=0))
        await session.commit()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        await _migrate_service_menu_category()
    except Exception as e:
        print("Aviso migración service menu category:", e)
    try:
        await _migrate_service_images()
    except Exception as e:
        print("Aviso migración service images:", e)
    try:
        await _migrate_scheduling_operations_extensions()
    except Exception as e:
        print("Aviso migración scheduling operations:", e)
    try:
        await _migrate_branch_location_chile()
    except Exception as e:
        print("Aviso migración branch location:", e)
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
    try:
        await _migrate_professional_invite_and_commissions()
    except Exception as e:
        print("Aviso migración professional invite/commissions:", e)
    try:
        await _migrate_work_stations()
    except Exception as e:
        print("Aviso migración work_stations:", e)
    try:
        await _migrate_product_branch_stock()
    except Exception as e:
        print("Aviso migración product_branch_stocks:", e)
    try:
        await _backfill_product_branch_stocks()
    except Exception as e:
        print("Aviso backfill product_branch_stocks:", e)

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
        if branch and not branch.region and branch.slug == "sede-central":
            branch.region = "Región Metropolitana de Santiago"
            branch.comuna = branch.comuna or "Santiago"
            branch.address_line = branch.address_line or "Av. Libertador Bernardo O'Higgins 1234 (demo)"
            if not branch.timezone or branch.timezone == "UTC":
                branch.timezone = "America/Santiago"
            await session.commit()
        if not branch:
            branch = Branch(
                store_id=store.id,
                name="Sede central",
                slug="sede-central",
                timezone="America/Santiago",
                region="Región Metropolitana de Santiago",
                comuna="Santiago",
                address_line="Av. Libertador Bernardo O'Higgins 1234 (demo)",
            )
            session.add(branch)
            await session.flush()
            await seed_work_stations_from_store_settings(
                session,
                store_id=store.id,
                branch_id=branch.id,
                store_settings={"local_structure": {"chair_count": 4, "room_count": 1}},
            )
            prof = Professional(
                store_id=store.id,
                name="Profesional demo",
                email="demo@revotake.com",
                phone="+56900000000",
            )
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
