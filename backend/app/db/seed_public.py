"""
seed_public.py — Datos de prueba completos para el sitio público RevoTake.

Genera: tiendas realistas (peluquería, nail, spa, barbería, estética),
branches con coordenadas GPS en Santiago, profesionales, servicios,
citas con reseñas, flash deals, eventos de tienda, usuarias públicas
y seguimiento de tiendas.

Ejecutar:
    docker compose exec backend python -m app.db.seed_public
"""
import asyncio
import random
import uuid
from datetime import datetime, date, timedelta, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.database import engine
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.store_type import StoreType
from app.models.store import Store, StoreMember, StoreMemberRole
from app.models.scheduling import (
    Branch,
    Professional,
    ProfessionalBranch,
    Service as SchedulingService,
    ProfessionalService,
    AvailabilityRule,
    Appointment,
    AppointmentReview,
    AvailabilityRuleType,
    AppointmentStatus,
    PaymentMode,
    PaymentStatus,
)
from app.models.client import Client
from app.models.flash_deal import FlashDeal
from app.models.store_event import StoreEvent
from app.models.public_user import PublicUser
from app.models.store_follower import StoreFollower
from app.models.event_rsvp import EventRSVP

AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def uid() -> str:
    return str(uuid.uuid4())


def now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def naive(dt: datetime) -> datetime:
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


# ─── Coordenadas reales de comunas de Santiago ────────────────────────────────

SANTIAGO_LOCATIONS = [
    {
        "region": "Región Metropolitana de Santiago",
        "comuna": "Providencia",
        "address": "Av. Providencia 1234, Providencia",
        "lat": -33.4327,
        "lng": -70.6093,
    },
    {
        "region": "Región Metropolitana de Santiago",
        "comuna": "Las Condes",
        "address": "Av. Apoquindo 4500, Las Condes",
        "lat": -33.4172,
        "lng": -70.5965,
    },
    {
        "region": "Región Metropolitana de Santiago",
        "comuna": "Ñuñoa",
        "address": "Av. Irarrázaval 2890, Ñuñoa",
        "lat": -33.4569,
        "lng": -70.6080,
    },
    {
        "region": "Región Metropolitana de Santiago",
        "comuna": "Santiago Centro",
        "address": "Av. Libertador Bernardo O'Higgins 890, Santiago",
        "lat": -33.4489,
        "lng": -70.6693,
    },
    {
        "region": "Región Metropolitana de Santiago",
        "comuna": "Vitacura",
        "address": "Av. Vitacura 3950, Vitacura",
        "lat": -33.3942,
        "lng": -70.5829,
    },
    {
        "region": "Región Metropolitana de Santiago",
        "comuna": "Maipú",
        "address": "Av. Pajaritos 3850, Maipú",
        "lat": -33.5085,
        "lng": -70.7595,
    },
    {
        "region": "Región Metropolitana de Santiago",
        "comuna": "La Florida",
        "address": "Av. Vicuña Mackenna 6700, La Florida",
        "lat": -33.5237,
        "lng": -70.5993,
    },
    {
        "region": "Región Metropolitana de Santiago",
        "comuna": "Bellavista",
        "address": "Constitución 88, Bellavista",
        "lat": -33.4278,
        "lng": -70.6456,
    },
]


REVIEW_COMMENTS = [
    "Excelente atención, muy profesional y puntual.",
    "Me encantó el resultado, definitivamente vuelvo.",
    "Muy buena experiencia, el local súper limpio.",
    "La profesional fue muy amable y cuidadosa.",
    "Quedé muy contenta, me hicieron exactamente lo que pedí.",
    "Buen trabajo aunque esperé un poco más de lo acordado.",
    "Recomendado 100%. Muy buen trato y resultado.",
    "El resultado superó mis expectativas, quedé espectacular.",
    "Muy prolija y cuidadosa, lo recomiendo a todas mis amigas.",
    "Ambiente agradable y personal muy atento.",
    "Primera vez que vengo y quedé completamente encantada.",
    "Precio justo para la calidad del servicio.",
    "Me trataron súper bien desde que llegué.",
    "El ambiente es precioso y la atención impecable.",
    "Cumplió todas mis expectativas, muy feliz con el resultado.",
]


# ─── Definición de tiendas ────────────────────────────────────────────────────

STORES = [
    {
        "name": "Salón Valentina Beauty",
        "slug": "salon-valentina-beauty",
        "type_slug": "peluqueria",
        "location": SANTIAGO_LOCATIONS[0],  # Providencia
        "pet_friendly": True,
        "delivery": False,
        "logo_color": "#7c3aed",
        "professionals": [
            {"name": "Valentina Rojas", "email": "valentina.r@demo.cl"},
            {"name": "Camila Soto", "email": "camila.s@demo.cl"},
        ],
        "services": [
            {"name": "Corte de cabello mujer", "category": "Cortes", "duration_minutes": 45, "price_cents": 1800000, "menu_sort_order": 1},
            {"name": "Corte + brushing", "category": "Cortes", "duration_minutes": 60, "price_cents": 2500000, "menu_sort_order": 2},
            {"name": "Tinte raíces", "category": "Color", "duration_minutes": 90, "price_cents": 3500000, "menu_sort_order": 3},
            {"name": "Balayage completo", "category": "Color", "duration_minutes": 180, "price_cents": 8500000, "menu_sort_order": 4},
            {"name": "Keratina brasileña", "category": "Tratamientos", "duration_minutes": 120, "price_cents": 6000000, "menu_sort_order": 5},
            {"name": "Hidratación profunda", "category": "Tratamientos", "duration_minutes": 60, "price_cents": 2800000, "menu_sort_order": 6},
            {"name": "Peinado de noche", "category": "Peinados", "duration_minutes": 60, "price_cents": 3000000, "menu_sort_order": 7},
        ],
        "flash_deal": {
            "title": "Corte + brushing con 30% OFF",
            "description": "Slot disponible esta semana por cancelación de última hora.",
            "discount_percent": 30,
        },
        "event": {
            "title": "Noche de Beauty — Tendencias 2026",
            "description": "Ven a conocer las tendencias de color y cortes para el año. Habrá degustaciones y sorteos.",
            "days_from_now": 14,
            "location_text": "Salón Valentina Beauty, Providencia",
        },
    },
    {
        "name": "Nail Studio Camila",
        "slug": "nail-studio-camila",
        "type_slug": "centro-de-manicure-y-pedicure",
        "location": SANTIAGO_LOCATIONS[2],  # Ñuñoa
        "pet_friendly": True,
        "delivery": True,
        "logo_color": "#db2777",
        "professionals": [
            {"name": "Camila Morales", "email": "camila.m@demo.cl"},
            {"name": "Daniela Pérez", "email": "daniela.p@demo.cl"},
        ],
        "services": [
            {"name": "Manicure gel semipermanente", "category": "Manos", "duration_minutes": 60, "price_cents": 2200000, "menu_sort_order": 1},
            {"name": "Manicure tradicional", "category": "Manos", "duration_minutes": 45, "price_cents": 1200000, "menu_sort_order": 2},
            {"name": "Pedicure spa", "category": "Pies", "duration_minutes": 75, "price_cents": 2500000, "menu_sort_order": 3},
            {"name": "Pedicure básico", "category": "Pies", "duration_minutes": 45, "price_cents": 1500000, "menu_sort_order": 4},
            {"name": "Nail art (diseño por uña)", "category": "Arte", "duration_minutes": 15, "price_cents": 500000, "menu_sort_order": 5},
            {"name": "Extensiones de uñas acrílico", "category": "Extensiones", "duration_minutes": 90, "price_cents": 3500000, "menu_sort_order": 6},
            {"name": "Retiro de gel + manicure", "category": "Manos", "duration_minutes": 75, "price_cents": 2800000, "menu_sort_order": 7},
            {"name": "Combo manos + pies gel", "category": "Combos", "duration_minutes": 120, "price_cents": 4200000, "menu_sort_order": 8},
        ],
        "flash_deal": {
            "title": "Pedicure spa a mitad de precio",
            "description": "Hora disponible hoy — cancela anticipada.",
            "discount_percent": 50,
        },
        "event": {
            "title": "Taller: Nail Art para Principiantes",
            "description": "Aprende técnicas básicas de nail art con nuestra especialista Camila. Cupos limitados.",
            "days_from_now": 10,
            "location_text": "Nail Studio Camila, Ñuñoa",
        },
    },
    {
        "name": "Spa Zen Vitacura",
        "slug": "spa-zen-vitacura",
        "type_slug": "spa",
        "location": SANTIAGO_LOCATIONS[4],  # Vitacura
        "pet_friendly": False,
        "delivery": False,
        "logo_color": "#059669",
        "professionals": [
            {"name": "Andrea Fuentes", "email": "andrea.f@demo.cl"},
            {"name": "Sofía Lagos", "email": "sofia.l@demo.cl"},
        ],
        "services": [
            {"name": "Masaje relajante 60 min", "category": "Masajes", "duration_minutes": 60, "price_cents": 4500000, "menu_sort_order": 1},
            {"name": "Masaje relajante 90 min", "category": "Masajes", "duration_minutes": 90, "price_cents": 6000000, "menu_sort_order": 2},
            {"name": "Masaje descontracturante", "category": "Masajes", "duration_minutes": 60, "price_cents": 5000000, "menu_sort_order": 3},
            {"name": "Facial hidratante profundo", "category": "Faciales", "duration_minutes": 60, "price_cents": 4000000, "menu_sort_order": 4},
            {"name": "Facial anti-age premium", "category": "Faciales", "duration_minutes": 75, "price_cents": 5500000, "menu_sort_order": 5},
            {"name": "Ritual completo spa 2h", "category": "Rituales", "duration_minutes": 120, "price_cents": 8500000, "menu_sort_order": 6},
            {"name": "Exfoliación corporal", "category": "Corporales", "duration_minutes": 60, "price_cents": 4800000, "menu_sort_order": 7},
        ],
        "flash_deal": {
            "title": "Ritual completo con 25% OFF",
            "description": "Disfruta nuestro ritual de 2 horas a precio especial. Válido solo hoy.",
            "discount_percent": 25,
        },
        "event": {
            "title": "Tarde de Bienestar — Meditación y Masajes",
            "description": "Una tarde de relajación total: meditación guiada, masajes express y aromaterapia. Entrada liberada para clientas frecuentes.",
            "days_from_now": 7,
            "location_text": "Spa Zen Vitacura, Vitacura",
        },
    },
    {
        "name": "Estética Glow Las Condes",
        "slug": "estetica-glow-las-condes",
        "type_slug": "centro-estetica",
        "location": SANTIAGO_LOCATIONS[1],  # Las Condes
        "pet_friendly": False,
        "delivery": True,
        "logo_color": "#d97706",
        "professionals": [
            {"name": "Francisca Muñoz", "email": "francisca.m@demo.cl"},
            {"name": "Javiera Torres", "email": "javiera.t@demo.cl"},
        ],
        "services": [
            {"name": "Limpieza facial profunda", "category": "Faciales", "duration_minutes": 60, "price_cents": 3500000, "menu_sort_order": 1},
            {"name": "Microdermoabrasión", "category": "Faciales", "duration_minutes": 45, "price_cents": 4000000, "menu_sort_order": 2},
            {"name": "Peeling químico suave", "category": "Faciales", "duration_minutes": 45, "price_cents": 4500000, "menu_sort_order": 3},
            {"name": "Depilación cejas + labio", "category": "Depilación", "duration_minutes": 20, "price_cents": 900000, "menu_sort_order": 4},
            {"name": "Depilación cera piernas completas", "category": "Depilación", "duration_minutes": 45, "price_cents": 2200000, "menu_sort_order": 5},
            {"name": "Depilación axilas", "category": "Depilación", "duration_minutes": 20, "price_cents": 1000000, "menu_sort_order": 6},
            {"name": "Radiofrequencia facial", "category": "Tratamientos Avanzados", "duration_minutes": 60, "price_cents": 5500000, "menu_sort_order": 7},
            {"name": "Tratamiento antimanchas", "category": "Tratamientos Avanzados", "duration_minutes": 60, "price_cents": 5000000, "menu_sort_order": 8},
        ],
        "flash_deal": {
            "title": "Limpieza facial + cejas por solo $29.990",
            "description": "Combo especial: limpieza profunda + depilación de cejas.",
            "discount_percent": 40,
        },
        "event": {
            "title": "Masterclass: Rutina de Skincare en 5 Pasos",
            "description": "Nuestra experta en estética te enseña cómo armar tu rutina facial ideal. Incluye muestra de productos.",
            "days_from_now": 21,
            "location_text": "Estética Glow, Las Condes",
        },
    },
    {
        "name": "Barbería Urbana Bellavista",
        "slug": "barberia-urbana-bellavista",
        "type_slug": "barberia",
        "location": SANTIAGO_LOCATIONS[7],  # Bellavista
        "pet_friendly": True,
        "delivery": False,
        "logo_color": "#1d4ed8",
        "professionals": [
            {"name": "Diego Contreras", "email": "diego.c@demo.cl"},
            {"name": "Matías Espinoza", "email": "matias.e@demo.cl"},
        ],
        "services": [
            {"name": "Corte clásico", "category": "Cortes", "duration_minutes": 30, "price_cents": 1200000, "menu_sort_order": 1},
            {"name": "Corte fade / degradé", "category": "Cortes", "duration_minutes": 40, "price_cents": 1500000, "menu_sort_order": 2},
            {"name": "Corte + barba combo", "category": "Combos", "duration_minutes": 60, "price_cents": 2200000, "menu_sort_order": 3},
            {"name": "Afeitado con navaja", "category": "Barba", "duration_minutes": 30, "price_cents": 1100000, "menu_sort_order": 4},
            {"name": "Arreglo de barba", "category": "Barba", "duration_minutes": 20, "price_cents": 800000, "menu_sort_order": 5},
            {"name": "Tinte para cabello", "category": "Color", "duration_minutes": 60, "price_cents": 2500000, "menu_sort_order": 6},
        ],
        "flash_deal": {
            "title": "Corte + degradé a $9.990",
            "description": "Slot especial para esta tarde. Primero en llegar, primero en atenderse.",
            "discount_percent": 35,
        },
        "event": {
            "title": "Barbería Night — Cerveza y cortes",
            "description": "Noche especial: cortes con precio especial y una cerveza artesanal incluida. Ambiente relajado y música en vivo.",
            "days_from_now": 5,
            "location_text": "Barbería Urbana, Bellavista",
        },
    },
    {
        "name": "Centro Pilates & Bienestar",
        "slug": "pilates-bienestar-nunoa",
        "type_slug": "pilates",
        "location": SANTIAGO_LOCATIONS[2],  # Ñuñoa
        "pet_friendly": False,
        "delivery": False,
        "logo_color": "#7c3aed",
        "professionals": [
            {"name": "Carolina Vega", "email": "carolina.v@demo.cl"},
            {"name": "Paola Flores", "email": "paola.f@demo.cl"},
        ],
        "services": [
            {"name": "Clase grupal pilates", "category": "Clases", "duration_minutes": 55, "price_cents": 1500000, "menu_sort_order": 1},
            {"name": "Clase individual pilates", "category": "Clases", "duration_minutes": 60, "price_cents": 4500000, "menu_sort_order": 2},
            {"name": "Pack 4 clases grupales", "category": "Packs", "duration_minutes": 55, "price_cents": 5000000, "menu_sort_order": 3},
            {"name": "Pack 8 clases grupales", "category": "Packs", "duration_minutes": 55, "price_cents": 9000000, "menu_sort_order": 4},
            {"name": "Clase de yoga", "category": "Clases", "duration_minutes": 60, "price_cents": 1500000, "menu_sort_order": 5},
        ],
        "flash_deal": {
            "title": "Clase individual de pilates con 20% OFF",
            "description": "Hora disponible mañana. Perfecto para probar el método.",
            "discount_percent": 20,
        },
        "event": {
            "title": "Retiro de Yoga y Meditación — Mañana en el parque",
            "description": "Unirte a nuestra clase al aire libre en el Parque de Ñuñoa. Lleva esterilla y ropa cómoda.",
            "days_from_now": 3,
            "location_text": "Parque de Ñuñoa, frente al centro",
        },
    },
]


# ─── Usuarias públicas de prueba ───────────────────────────────────────────────

PUBLIC_USERS_DATA = [
    {"name": "Valentina López", "email": "valentina.lopez@ejemplo.cl", "phone": "+56912345678"},
    {"name": "Camila Morales", "email": "camila.morales@ejemplo.cl", "phone": "+56923456789"},
    {"name": "Javiera Rojas", "email": "javiera.rojas@ejemplo.cl", "phone": "+56934567890"},
    {"name": "Daniela Pérez", "email": "daniela.perez@ejemplo.cl", "phone": "+56945678901"},
    {"name": "Francisca Silva", "email": "francisca.silva@ejemplo.cl", "phone": "+56956789012"},
    {"name": "Catalina Muñoz", "email": "catalina.munoz@ejemplo.cl", "phone": "+56967890123"},
    {"name": "Bárbara Castro", "email": "barbara.castro@ejemplo.cl", "phone": "+56978901234"},
    {"name": "Constanza Díaz", "email": "constanza.diaz@ejemplo.cl", "phone": "+56989012345"},
]

DEFAULT_PASSWORD = "demo1234"  # Todas las usuarias de prueba usan esta contraseña


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _build_store_settings(s: dict) -> dict:
    loc = s["location"]
    amenities: dict = {
        "mascotas_bienvenidas": s["pet_friendly"],
        "domicilio": s["delivery"],
        "wifi": random.choice([True, False]),
        "cafeteria": random.choice([True, False]),
        "sala_espera": True,
        "acceso_movilidad": random.choice([True, False]),
        "pago_tarjeta": True,
        "pago_digital": True,
        "estacionamiento": random.choice(["no", "si_gratis", "limitado"]),
        "higiene_visible": True,
    }
    return {
        "ai": {"business_context": f"Tienda de belleza en {loc['comuna']}.", "tone": "warm"},
        "stock": {"replenishment_buffer_days": 2},
        "agenda": {"default_duration_minutes": 45, "reminder_hours_before": 24},
        "local_structure": {"chair_count": 3, "room_count": 1},
        "store_profile": {
            "profile_version": 2,
            "branding": {"logo_url": ""},
            "location_public": {
                "direccion_atencion": loc["address"],
                "comuna": loc["comuna"],
                "region": loc["region"],
                "referencias_acceso": "A media cuadra del metro. Busca el letrero rosado en la entrada.",
                "google_maps_url": f"https://maps.google.com/?q={loc['lat']},{loc['lng']}",
            },
            "horarios": {
                "lun_vie": "09:00 – 19:00",
                "sabado": "09:00 – 17:00",
                "domingo_feriados": "Cerrado",
                "notas": "",
            },
            "amenities": amenities,
        },
    }


async def _get_or_create(session: AsyncSession, model, where_clause, factory):
    r = await session.execute(select(model).where(where_clause))
    obj = r.scalar_one_or_none()
    if obj:
        return obj, False
    obj = factory()
    session.add(obj)
    await session.flush()
    return obj, True


# ─── Seed principal ───────────────────────────────────────────────────────────

async def seed_public():
    async with AsyncSessionLocal() as session:
        print("\n=== SEED PÚBLICO REVOTAKE ===\n")

        # 1. Admin user para tiendas de demo
        admin_user, _ = await _get_or_create(
            session, User,
            User.email == "admin.demo@revotake.cl",
            lambda: User(
                id=uid(),
                email="admin.demo@revotake.cl",
                name="Admin Demo Público",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.ADMIN,
            ),
        )
        await session.commit()
        print(f"[admin] {admin_user.email}")

        # 2. Crear/obtener tiendas
        stores_created = {}
        for s in STORES:
            # StoreType
            tr = await session.execute(select(StoreType).where(StoreType.slug == s["type_slug"]))
            store_type = tr.scalar_one_or_none()
            if not store_type:
                # fallback al primero disponible
                tr = await session.execute(select(StoreType).limit(1))
                store_type = tr.scalar_one()

            store, created = await _get_or_create(
                session, Store,
                Store.slug == s["slug"],
                lambda s=s, st=store_type: Store(
                    id=uid(),
                    name=s["name"],
                    slug=s["slug"],
                    store_type_id=st.id,
                    settings=_build_store_settings(s),
                    is_active=True,
                ),
            )
            stores_created[s["slug"]] = (store, s)
            if created:
                print(f"[+] Tienda: {s['name']}")

                # StoreMember (admin)
                session.add(StoreMember(
                    id=uid(),
                    store_id=store.id,
                    user_id=admin_user.id,
                    role=StoreMemberRole.ADMIN,
                ))

        await session.commit()

        # 3. Branches con coordenadas GPS
        branches_map = {}  # slug → Branch
        for s_slug, (store, s_data) in stores_created.items():
            loc = s_data["location"]
            branch, created = await _get_or_create(
                session, Branch,
                (Branch.store_id == store.id) & (Branch.slug == f"{s_slug}-sede"),
                lambda store=store, loc=loc, s_slug=s_slug: Branch(
                    id=uid(),
                    store_id=store.id,
                    name="Sede principal",
                    slug=f"{s_slug}-sede",
                    timezone="America/Santiago",
                    region=loc["region"],
                    comuna=loc["comuna"],
                    address_line=loc["address"],
                    is_active=True,
                    settings={},
                ),
            )
            if created:
                # Actualizar lat/lng vía SQL (nueva columna migrada)
                await session.execute(
                    text("UPDATE branches SET latitude=:lat, longitude=:lng WHERE id=:id"),
                    {"lat": loc["lat"] + random.uniform(-0.005, 0.005),
                     "lng": loc["lng"] + random.uniform(-0.005, 0.005),
                     "id": branch.id},
                )
                print(f"  [+] Branch: {branch.name} ({loc['comuna']})")
            branches_map[s_slug] = branch

        await session.commit()

        # 4. Profesionales, availability y servicios
        professionals_map = {}  # s_slug → list[Professional]
        services_map = {}  # s_slug → list[SchedulingService]

        for s_slug, (store, s_data) in stores_created.items():
            branch = branches_map[s_slug]
            profs_for_store = []
            svcs_for_store = []

            # Profesionales
            for p in s_data["professionals"]:
                professional, created = await _get_or_create(
                    session, Professional,
                    (Professional.store_id == store.id) & (Professional.email == p["email"]),
                    lambda store=store, p=p: Professional(
                        id=uid(),
                        store_id=store.id,
                        name=p["name"],
                        email=p["email"],
                        is_active=True,
                    ),
                )
                if created:
                    print(f"  [+] Profesional: {p['name']}")

                # ProfessionalBranch
                pb_r = await session.execute(
                    select(ProfessionalBranch)
                    .where(
                        ProfessionalBranch.professional_id == professional.id,
                        ProfessionalBranch.branch_id == branch.id,
                    )
                )
                if not pb_r.scalar_one_or_none():
                    session.add(ProfessionalBranch(
                        id=uid(),
                        professional_id=professional.id,
                        branch_id=branch.id,
                        station_mode="none",
                    ))

                # AvailabilityRule (lun-vie 9-19, sáb 9-17)
                ar_r = await session.execute(
                    select(AvailabilityRule)
                    .where(
                        AvailabilityRule.professional_id == professional.id,
                        AvailabilityRule.branch_id == branch.id,
                    )
                )
                if not ar_r.scalar_one_or_none():
                    from datetime import time as dtime
                    for wd in range(5):  # lun-vie
                        session.add(AvailabilityRule(
                            id=uid(),
                            professional_id=professional.id,
                            branch_id=branch.id,
                            rule_type=AvailabilityRuleType.WEEKLY,
                            weekday=wd,
                            start_time=dtime(9, 0),
                            end_time=dtime(19, 0),
                        ))
                    session.add(AvailabilityRule(  # sab
                        id=uid(),
                        professional_id=professional.id,
                        branch_id=branch.id,
                        rule_type=AvailabilityRuleType.WEEKLY,
                        weekday=5,
                        start_time=dtime(9, 0),
                        end_time=dtime(17, 0),
                    ))

                profs_for_store.append(professional)

            # Servicios
            for svc_data in s_data["services"]:
                svc, created = await _get_or_create(
                    session, SchedulingService,
                    (SchedulingService.store_id == store.id) & (SchedulingService.slug == svc_data["name"].lower().replace(" ", "-").replace("+", "mas")[:60]),
                    lambda store=store, svc_data=svc_data: SchedulingService(
                        id=uid(),
                        store_id=store.id,
                        name=svc_data["name"],
                        slug=svc_data["name"].lower().replace(" ", "-").replace("+", "mas")[:60],
                        category=svc_data["category"],
                        duration_minutes=svc_data["duration_minutes"],
                        price_cents=svc_data["price_cents"] // 100,  # cents
                        menu_sort_order=svc_data["menu_sort_order"],
                        is_active=True,
                        cancellation_hours=24,
                        cancellation_fee_cents=0,
                        deposit_required_cents=0,
                    ),
                )
                if created:
                    # ProfessionalService para todos los profesionales
                    for prof in profs_for_store:
                        ps_r = await session.execute(
                            select(ProfessionalService)
                            .where(
                                ProfessionalService.professional_id == prof.id,
                                ProfessionalService.service_id == svc.id,
                            )
                        )
                        if not ps_r.scalar_one_or_none():
                            session.add(ProfessionalService(
                                id=uid(),
                                professional_id=prof.id,
                                service_id=svc.id,
                            ))
                svcs_for_store.append(svc)

            professionals_map[s_slug] = profs_for_store
            services_map[s_slug] = svcs_for_store

        await session.commit()
        print("\n[OK] Tiendas, branches, profesionales y servicios listos")

        # 5. Clientes y citas con reseñas (historial realista)
        CLIENTAS = [
            ("Valentina López", "valentina.lopez@ejemplo.cl", "+56912345678"),
            ("Camila Morales", "camila.morales@ejemplo.cl", "+56923456789"),
            ("Javiera Rojas", "javiera.rojas@ejemplo.cl", "+56934567890"),
            ("Daniela Pérez", "daniela.perez@ejemplo.cl", "+56945678901"),
            ("Francisca Silva", "francisca.silva@ejemplo.cl", "+56956789012"),
            ("Catalina Muñoz", "catalina.munoz@ejemplo.cl", "+56967890123"),
            ("Bárbara Castro", "barbara.castro@ejemplo.cl", "+56978901234"),
            ("Constanza Díaz", "constanza.diaz@ejemplo.cl", "+56989012345"),
        ]

        for s_slug, (store, s_data) in stores_created.items():
            branch = branches_map[s_slug]
            profs = professionals_map[s_slug]
            svcs = services_map[s_slug]
            if not profs or not svcs:
                continue

            for i, (nombre, email, phone) in enumerate(CLIENTAS):
                # Crear cliente en la tienda
                client, _ = await _get_or_create(
                    session, Client,
                    (Client.store_id == store.id) & (Client.email == email),
                    lambda store=store, nombre=nombre, email=email, phone=phone: Client(
                        id=uid(),
                        store_id=store.id,
                        name=nombre,
                        email=email,
                        phone=phone,
                        preferences={},
                        custom_fields={},
                    ),
                )

                # 2-4 citas por clienta por tienda (pasadas → con reseña)
                n_appts = random.randint(2, 4)
                for k in range(n_appts):
                    days_ago = random.randint(7, 180)
                    start = now_naive() - timedelta(days=days_ago, hours=random.randint(9, 17))
                    start = start.replace(minute=0, second=0, microsecond=0)
                    prof = random.choice(profs)
                    svc = random.choice(svcs)
                    end = start + timedelta(minutes=svc.duration_minutes)

                    appt_r = await session.execute(
                        select(Appointment)
                        .where(
                            Appointment.client_id == client.id,
                            Appointment.start_time == start,
                        )
                    )
                    if appt_r.scalar_one_or_none():
                        continue

                    appt = Appointment(
                        id=uid(),
                        store_id=store.id,
                        branch_id=branch.id,
                        professional_id=prof.id,
                        service_id=svc.id,
                        client_id=client.id,
                        start_time=start,
                        end_time=end,
                        status=AppointmentStatus.COMPLETED,
                        payment_mode=PaymentMode.ON_SITE,
                        payment_status=PaymentStatus.PAID,
                        manage_token=uid(),
                        charged_price_cents=svc.price_cents,
                        session_closed_at=end,
                    )
                    session.add(appt)
                    await session.flush()

                    # Reseña (80% de probabilidad)
                    if random.random() < 0.8:
                        rating = random.choices([3, 4, 5, 5, 5], k=1)[0]
                        session.add(AppointmentReview(
                            id=uid(),
                            appointment_id=appt.id,
                            store_id=store.id,
                            professional_id=prof.id,
                            rating=rating,
                            comment=random.choice(REVIEW_COMMENTS) if random.random() < 0.7 else None,
                        ))

        await session.commit()
        print("[OK] Citas y reseñas creadas")

        # 6. Flash Deals (activos, vencen en 3 días)
        for s_slug, (store, s_data) in stores_created.items():
            branch = branches_map[s_slug]
            profs = professionals_map[s_slug]
            svcs = services_map[s_slug]
            if not profs or not svcs:
                continue

            deal_data = s_data.get("flash_deal")
            if not deal_data:
                continue

            fd_r = await session.execute(
                select(FlashDeal).where(
                    FlashDeal.store_id == store.id,
                    FlashDeal.is_active.is_(True),
                )
            )
            if fd_r.scalar_one_or_none():
                continue  # Ya existe uno activo

            svc = svcs[0]
            prof = profs[0]
            slot_start = now_naive() + timedelta(days=2, hours=10)
            slot_end = slot_start + timedelta(minutes=svc.duration_minutes)
            expires_at = now_naive() + timedelta(days=3)

            session.add(FlashDeal(
                id=uid(),
                store_id=store.id,
                branch_id=branch.id,
                professional_id=prof.id,
                service_id=svc.id,
                discount_percent=deal_data["discount_percent"],
                original_price_cents=svc.price_cents,
                slot_start_time=slot_start,
                slot_end_time=slot_end,
                title=deal_data["title"],
                description=deal_data["description"],
                expires_at=expires_at,
                is_active=True,
                created_by=admin_user.id,
            ))

        await session.commit()
        print("[OK] Flash Deals creados")

        # 7. Eventos de tienda (próximos)
        for s_slug, (store, s_data) in stores_created.items():
            evt_data = s_data.get("event")
            if not evt_data:
                continue

            ev_r = await session.execute(
                select(StoreEvent).where(
                    StoreEvent.store_id == store.id,
                    StoreEvent.is_active.is_(True),
                )
            )
            if ev_r.scalar_one_or_none():
                continue

            event_date = now_naive() + timedelta(days=evt_data["days_from_now"], hours=19)
            session.add(StoreEvent(
                id=uid(),
                store_id=store.id,
                title=evt_data["title"],
                description=evt_data["description"],
                event_date=event_date,
                location_text=evt_data["location_text"],
                image_url=None,
                max_attendees=random.choice([20, 30, 50, None]),
                is_active=True,
            ))

        await session.commit()
        print("[OK] Eventos de tienda creados")

        # 8. Usuarias públicas
        public_users = []
        for u in PUBLIC_USERS_DATA:
            pu, created = await _get_or_create(
                session, PublicUser,
                PublicUser.email == u["email"],
                lambda u=u: PublicUser(
                    id=uid(),
                    name=u["name"],
                    email=u["email"],
                    phone=u["phone"],
                    password_hash=get_password_hash(DEFAULT_PASSWORD),
                    is_active=True,
                ),
            )
            public_users.append(pu)
            if created:
                print(f"  [+] Usuaria pública: {u['name']} / {DEFAULT_PASSWORD}")

        await session.commit()

        # 9. Seguimiento de tiendas (cada usuaria sigue 2-4 tiendas)
        store_list = list(stores_created.values())
        for pu in public_users:
            tiendas_a_seguir = random.sample(store_list, min(random.randint(2, 4), len(store_list)))
            for (store, _) in tiendas_a_seguir:
                sf_r = await session.execute(
                    select(StoreFollower).where(
                        StoreFollower.public_user_id == pu.id,
                        StoreFollower.store_id == store.id,
                    )
                )
                if not sf_r.scalar_one_or_none():
                    session.add(StoreFollower(
                        id=uid(),
                        public_user_id=pu.id,
                        store_id=store.id,
                    ))

        await session.commit()
        print("[OK] Seguimiento de tiendas configurado")

        # 10. RSVPs a eventos (algunas usuarias aceptan)
        all_events_r = await session.execute(
            select(StoreEvent).where(StoreEvent.is_active.is_(True))
        )
        all_events = all_events_r.scalars().all()

        for evt in all_events:
            # 3-5 usuarias aceptan o declinan el evento
            respondentes = random.sample(public_users, min(random.randint(3, 5), len(public_users)))
            for pu in respondentes:
                # Solo si sigue la tienda
                sf_r = await session.execute(
                    select(StoreFollower).where(
                        StoreFollower.public_user_id == pu.id,
                        StoreFollower.store_id == evt.store_id,
                    )
                )
                if not sf_r.scalar_one_or_none():
                    continue
                rsvp_r = await session.execute(
                    select(EventRSVP).where(
                        EventRSVP.event_id == evt.id,
                        EventRSVP.public_user_id == pu.id,
                    )
                )
                if not rsvp_r.scalar_one_or_none():
                    status = random.choices(["accepted", "declined"], weights=[0.75, 0.25])[0]
                    session.add(EventRSVP(
                        id=uid(),
                        event_id=evt.id,
                        public_user_id=pu.id,
                        status=status,
                    ))

        await session.commit()
        print("[OK] RSVPs de eventos configurados")

        # ─── Resumen final ────────────────────────────────────────────────────
        print("\n" + "=" * 50)
        print("SEED PÚBLICO COMPLETADO")
        print("=" * 50)
        print(f"  Tiendas: {len(stores_created)}")
        print(f"  Usuarias públicas: {len(public_users)}")
        print(f"  Contraseña de prueba: {DEFAULT_PASSWORD}")
        print()
        print("Credenciales de usuarias:")
        for u in PUBLIC_USERS_DATA:
            print(f"  {u['email']}  /  {DEFAULT_PASSWORD}")
        print()
        print("Acceso al sitio público:")
        print("  http://public-revotake.golinkia.com/explorar")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(seed_public())
