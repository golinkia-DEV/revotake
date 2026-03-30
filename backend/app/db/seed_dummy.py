"""
seed_dummy.py — Pobla la BD con datos de prueba realistas para RevoTake.

Ejecutar:
    docker compose exec backend python -m app.db.seed_dummy

El script es idempotente: comprueba existencia por slug/email/SKU antes de insertar.
"""
import asyncio
import random
import uuid
from datetime import datetime, date, time, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.database import engine
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.store_type import StoreType
from app.models.store import Store, StoreMember, StoreMemberRole
from app.models.client import Client
from app.models.ticket import Ticket, TicketType, TicketStatus
from app.models.product import Product, ProductBranchStock
from app.models.purchase import Purchase
from app.models.scheduling import (
    Branch,
    WorkStation,
    Professional,
    ProfessionalBranch,
    Service as SchedulingService,
    ProfessionalService,
    AvailabilityRule,
    Appointment,
    AppointmentReview,
    WaitlistEntry,
    AvailabilityRuleType,
    AppointmentStatus,
    PaymentMode,
    PaymentStatus,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def uid() -> str:
    return str(uuid.uuid4())


def rnd_phone() -> str:
    digits = "".join(str(random.randint(0, 9)) for _ in range(8))
    return f"+569{digits}"


def slugify(text: str) -> str:
    import unicodedata
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return text.lower().replace(" ", "-").replace("(", "").replace(")", "").replace(".", "")


AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# ---------------------------------------------------------------------------
# Datos crudos
# ---------------------------------------------------------------------------

NOMBRES = [
    "Valentina López", "Camila Morales", "Javiera Rojas", "Daniela Pérez",
    "Francisca Silva", "Catalina Muñoz", "Bárbara Castro", "Constanza Díaz",
    "Natalia González", "Alejandra Hernández", "María Fernanda Torres",
    "Claudia Ramírez", "Carolina Vega", "Paola Flores", "Andrea Soto",
    "Felipe Araya", "Diego Contreras", "Matías Espinoza", "Sebastián Fuentes",
    "Ignacio Gutiérrez", "Cristián Ibáñez", "Rodrigo Jara", "Pablo Leal",
    "Nicolás Meza", "Tomás Navarro", "Andrés Ortiz", "Javier Pizarro",
    "Marco Quinteros", "Luis Riquelme", "Eduardo Salinas", "Carlos Trujillo",
    "Hugo Urrutia", "Raúl Valdivia", "Antonio Zamora", "Miguel Acuña",
    "Alejandro Bravo", "Gabriel Campos", "Roberto Delgado", "José Estrada",
]

COMUNAS_RM = [
    ("Región Metropolitana de Santiago", "Santiago"),
    ("Región Metropolitana de Santiago", "Providencia"),
    ("Región Metropolitana de Santiago", "Las Condes"),
    ("Región Metropolitana de Santiago", "Ñuñoa"),
    ("Región Metropolitana de Santiago", "Maipú"),
]

COMUNAS_OHIGGINS = [
    ("Región del Libertador General Bernardo O'Higgins", "Rancagua"),
    ("Región del Libertador General Bernardo O'Higgins", "Machalí"),
    ("Región del Libertador General Bernardo O'Higgins", "San Fernando"),
]

COMUNAS_BIO = [
    ("Región del Biobío", "Concepción"),
    ("Región del Biobío", "Talcahuano"),
    ("Región del Biobío", "Chillán"),
]

ALL_COMUNAS = COMUNAS_RM + COMUNAS_OHIGGINS + COMUNAS_BIO

REVIEW_COMMENTS = [
    "Excelente atención, muy profesional.",
    "Me encantó el resultado, volveré pronto.",
    "Muy buena experiencia, el local muy limpio.",
    "El profesional fue muy amable y puntual.",
    "Quedé muy contenta con el servicio.",
    "Buen trabajo, aunque esperé un poco más de lo previsto.",
    "Recomendado 100%. Muy buen trato.",
    "El resultado superó mis expectativas.",
    "Muy prolijo y cuidadoso, lo recomiendo.",
    "Ambiente agradable y personal atento.",
    "Quedé conforme aunque el precio es un poco alto.",
    "Primera vez que vengo y quedé encantada.",
]

# ---------------------------------------------------------------------------
# Paso 1 — Tiendas adicionales
# ---------------------------------------------------------------------------

STORES_DATA = [
    {
        "name": "Barbería El Maestro",
        "slug": "barberia-el-maestro",
        "type_slug": "barberia",
        "settings": {
            "ai": {"business_context": "Barbería clásica especializada en cortes masculinos y afeitado con navaja.", "tone": "professional"},
            "stock": {"replenishment_buffer_days": 3},
            "agenda": {"default_duration_minutes": 30, "reminder_hours_before": 24},
            "local_structure": {"chair_count": 5, "room_count": 0},
        },
    },
    {
        "name": "Spa & Bienestar Aurora",
        "slug": "spa-bienestar-aurora",
        "type_slug": "spa",
        "settings": {
            "ai": {"business_context": "Spa de relajación y tratamientos corporales en Providencia.", "tone": "warm"},
            "stock": {"replenishment_buffer_days": 2},
            "agenda": {"default_duration_minutes": 60, "reminder_hours_before": 24},
            "local_structure": {"chair_count": 2, "room_count": 4},
        },
    },
]

# ---------------------------------------------------------------------------
# Paso 2 — Usuarios
# ---------------------------------------------------------------------------

USERS_DATA = [
    {"email": "gerente.barberia@demo.cl", "name": "Andrés Maestro", "role": UserRole.ADMIN},
    {"email": "gerente.spa@demo.cl", "name": "Verónica Aurora", "role": UserRole.ADMIN},
    {"email": "recepcion.barberia@demo.cl", "name": "Sofía Recepción", "role": UserRole.SELLER},
    {"email": "recepcion.spa@demo.cl", "name": "Ignacio Recepción", "role": UserRole.SELLER},
    {"email": "operador1@demo.cl", "name": "Carlos Estilista", "role": UserRole.OPERATOR},
    {"email": "operador2@demo.cl", "name": "Patricia Masajista", "role": UserRole.OPERATOR},
    {"email": "operador3@demo.cl", "name": "Roberto Barbero", "role": UserRole.OPERATOR},
]

# ---------------------------------------------------------------------------
# Servicios por tienda
# ---------------------------------------------------------------------------

BARBERIA_SERVICIOS = [
    {"name": "Corte clásico", "slug": "corte-clasico", "category": "Cortes", "duration_minutes": 30, "price_cents": 8000, "menu_sort_order": 1},
    {"name": "Corte fade", "slug": "corte-fade", "category": "Cortes", "duration_minutes": 40, "price_cents": 12000, "menu_sort_order": 2},
    {"name": "Afeitado con navaja", "slug": "afeitado-navaja", "category": "Afeitado", "duration_minutes": 30, "price_cents": 9000, "menu_sort_order": 3},
    {"name": "Corte + afeitado combo", "slug": "corte-afeitado-combo", "category": "Combos", "duration_minutes": 60, "price_cents": 18000, "menu_sort_order": 4},
    {"name": "Arreglo barba", "slug": "arreglo-barba", "category": "Afeitado", "duration_minutes": 20, "price_cents": 6000, "menu_sort_order": 5},
    {"name": "Tinte de barba", "slug": "tinte-barba", "category": "Color", "duration_minutes": 30, "price_cents": 10000, "menu_sort_order": 6},
    {"name": "Tratamiento capilar", "slug": "tratamiento-capilar-barberia", "category": "Tratamientos", "duration_minutes": 45, "price_cents": 15000, "menu_sort_order": 7},
    {"name": "Corte niño (hasta 12)", "slug": "corte-nino", "category": "Cortes", "duration_minutes": 25, "price_cents": 6000, "menu_sort_order": 8},
]

SPA_SERVICIOS = [
    {"name": "Masaje relajante 60 min", "slug": "masaje-relajante-60", "category": "Masajes", "duration_minutes": 60, "price_cents": 45000, "menu_sort_order": 1},
    {"name": "Masaje relajante 90 min", "slug": "masaje-relajante-90", "category": "Masajes", "duration_minutes": 90, "price_cents": 60000, "menu_sort_order": 2},
    {"name": "Masaje deportivo", "slug": "masaje-deportivo", "category": "Masajes", "duration_minutes": 60, "price_cents": 50000, "menu_sort_order": 3},
    {"name": "Facial hidratante", "slug": "facial-hidratante", "category": "Faciales", "duration_minutes": 60, "price_cents": 40000, "menu_sort_order": 4},
    {"name": "Facial anti-age", "slug": "facial-anti-age", "category": "Faciales", "duration_minutes": 75, "price_cents": 55000, "menu_sort_order": 5},
    {"name": "Exfoliación corporal", "slug": "exfoliacion-corporal", "category": "Tratamientos Corporales", "duration_minutes": 60, "price_cents": 48000, "menu_sort_order": 6},
    {"name": "Envoltura de algas", "slug": "envoltura-algas", "category": "Tratamientos Corporales", "duration_minutes": 75, "price_cents": 52000, "menu_sort_order": 7},
    {"name": "Reflexología podal", "slug": "reflexologia-podal", "category": "Masajes", "duration_minutes": 45, "price_cents": 35000, "menu_sort_order": 8},
    {"name": "Ritual completo spa", "slug": "ritual-spa-completo", "category": "Rituales", "duration_minutes": 120, "price_cents": 80000, "menu_sort_order": 9},
    {"name": "Aromaterapia", "slug": "aromaterapia", "category": "Tratamientos Corporales", "duration_minutes": 60, "price_cents": 42000, "menu_sort_order": 10},
]

# Productos por tienda
BARBERIA_PRODUCTOS = [
    {"name": "Pomada fijadora mate", "sku": "BAR-POM-001", "price": 12990, "stock": 30, "category": "Estilizado"},
    {"name": "Cera para pelo", "sku": "BAR-CER-001", "price": 9990, "stock": 25, "category": "Estilizado"},
    {"name": "Aceite para barba premium", "sku": "BAR-ACE-001", "price": 15990, "stock": 20, "category": "Barba"},
    {"name": "Bálsamo acondicionador barba", "sku": "BAR-BAL-001", "price": 11990, "stock": 18, "category": "Barba"},
    {"name": "Shampoo barba 200ml", "sku": "BAR-SHA-001", "price": 8990, "stock": 22, "category": "Barba"},
    {"name": "Loción post-afeitado", "sku": "BAR-LOC-001", "price": 13990, "stock": 15, "category": "Afeitado"},
    {"name": "Gel para cabello fuerte", "sku": "BAR-GEL-001", "price": 7990, "stock": 28, "category": "Estilizado"},
    {"name": "Tinte barba negro natural", "sku": "BAR-TIN-001", "price": 9500, "stock": 12, "category": "Color"},
]

SPA_PRODUCTOS = [
    {"name": "Aceite esencial lavanda 30ml", "sku": "SPA-ACE-001", "price": 18990, "stock": 20, "category": "Aromaterapia"},
    {"name": "Aceite esencial eucaliptus 30ml", "sku": "SPA-ACE-002", "price": 16990, "stock": 15, "category": "Aromaterapia"},
    {"name": "Crema corporal hidratante 300ml", "sku": "SPA-CRE-001", "price": 24990, "stock": 18, "category": "Cuidado Corporal"},
    {"name": "Exfoliante corporal sal del Himalaya", "sku": "SPA-EXF-001", "price": 21990, "stock": 12, "category": "Cuidado Corporal"},
    {"name": "Mascarilla facial arcilla blanca", "sku": "SPA-MAS-001", "price": 19990, "stock": 16, "category": "Cuidado Facial"},
    {"name": "Sérum vitamina C facial", "sku": "SPA-SER-001", "price": 35990, "stock": 10, "category": "Cuidado Facial"},
    {"name": "Vela aromática relax 200g", "sku": "SPA-VEL-001", "price": 14990, "stock": 25, "category": "Ambientación"},
    {"name": "Piedras calientes basalto (set 6)", "sku": "SPA-PIE-001", "price": 45990, "stock": 5, "category": "Equipamiento"},
    {"name": "Toalla premium 70x140cm", "sku": "SPA-TOA-001", "price": 12990, "stock": 30, "category": "Textiles"},
    {"name": "Sales de baño relajantes 500g", "sku": "SPA-SAL-001", "price": 11990, "stock": 22, "category": "Cuidado Corporal"},
]

TICKET_TITLES_LEAD = [
    "Consulta por paquete corporativo", "Interés en membresía anual", "Solicitud cotización evento",
    "Cliente potencial redes sociales", "Derivación desde recomendación", "Consulta por promoción",
]
TICKET_TITLES_TASK = [
    "Llamar para confirmar cita reagendada", "Enviar catálogo de servicios",
    "Seguimiento cliente inactivo 3 meses", "Revisar disponibilidad profesional",
]
TICKET_TITLES_INCIDENT = [
    "Cliente insatisfecho con resultado", "Alergia post-tratamiento reportada",
    "Reclamo por tiempo de espera", "Producto defectuoso reportado",
]


# ---------------------------------------------------------------------------
# Funciones de seed por entidad
# ---------------------------------------------------------------------------

async def _get_or_create_store(session: AsyncSession, data: dict, fallback_type_id: str) -> Store:
    r = await session.execute(select(Store).where(Store.slug == data["slug"]))
    store = r.scalar_one_or_none()
    if store:
        print(f"  [skip] Store ya existe: {data['slug']}")
        return store

    # Busca el store_type por slug; si no existe usa el fallback (generic)
    tr = await session.execute(select(StoreType).where(StoreType.slug == data["type_slug"]))
    st = tr.scalar_one_or_none()
    if not st:
        tr2 = await session.execute(select(StoreType).where(StoreType.id == fallback_type_id))
        st = tr2.scalar_one_or_none()

    store = Store(
        id=uid(),
        name=data["name"],
        slug=data["slug"],
        store_type_id=st.id,
        settings=data["settings"],
    )
    session.add(store)
    await session.flush()
    print(f"  [+] Store creada: {data['name']}")
    return store


async def _get_or_create_user(session: AsyncSession, data: dict) -> User:
    r = await session.execute(select(User).where(User.email == data["email"]))
    user = r.scalar_one_or_none()
    if user:
        return user
    user = User(
        id=uid(),
        email=data["email"],
        name=data["name"],
        hashed_password=get_password_hash("demo1234"),
        role=data["role"],
    )
    session.add(user)
    await session.flush()
    print(f"  [+] Usuario: {data['email']}")
    return user


async def _link_member(session: AsyncSession, user_id: str, store_id: str, role: StoreMemberRole):
    r = await session.execute(
        select(StoreMember).where(StoreMember.user_id == user_id, StoreMember.store_id == store_id)
    )
    if r.scalar_one_or_none() is None:
        session.add(StoreMember(id=uid(), user_id=user_id, store_id=store_id, role=role))
        await session.flush()


async def _seed_branches(session: AsyncSession, store: Store, comunas: list) -> list[Branch]:
    branches = []
    for i, (region, comuna) in enumerate(comunas):
        slug = f"sede-{slugify(comuna)}"
        r = await session.execute(
            select(Branch).where(Branch.store_id == store.id, Branch.slug == slug)
        )
        branch = r.scalar_one_or_none()
        if branch:
            branches.append(branch)
            continue
        branch = Branch(
            id=uid(),
            store_id=store.id,
            name=f"Sede {comuna}",
            slug=slug,
            timezone="America/Santiago",
            region=region,
            comuna=comuna,
            address_line=f"Av. Principal {random.randint(100, 9999)}, {comuna}",
            is_active=True,
        )
        session.add(branch)
        await session.flush()
        print(f"    [+] Branch: {branch.name}")
        branches.append(branch)
    return branches


async def _seed_work_stations(session: AsyncSession, store: Store, branch: Branch, n_chairs: int, n_rooms: int) -> list[WorkStation]:
    stations = []
    existing = await session.execute(
        select(WorkStation).where(WorkStation.branch_id == branch.id)
    )
    if existing.scalars().all():
        return []  # ya existen

    for i in range(n_chairs):
        ws = WorkStation(
            id=uid(), store_id=store.id, branch_id=branch.id,
            name=f"Sillón {i + 1}", kind="chair", sort_order=i, is_active=True,
        )
        session.add(ws)
        stations.append(ws)
    for j in range(n_rooms):
        ws = WorkStation(
            id=uid(), store_id=store.id, branch_id=branch.id,
            name=f"Sala {j + 1}", kind="room", sort_order=n_chairs + j, is_active=True,
        )
        session.add(ws)
        stations.append(ws)
    await session.flush()
    return stations


async def _seed_professionals(session: AsyncSession, store: Store, names: list[str]) -> list[Professional]:
    profs = []
    for name in names:
        r = await session.execute(
            select(Professional).where(Professional.store_id == store.id, Professional.name == name)
        )
        prof = r.scalar_one_or_none()
        if prof:
            profs.append(prof)
            continue
        prof = Professional(
            id=uid(), store_id=store.id, name=name,
            email=f"{slugify(name).replace('-', '.')}@{slugify(store.name)}.cl",
            phone=rnd_phone(),
            is_active=True,
        )
        session.add(prof)
        await session.flush()
        profs.append(prof)
    print(f"    [+] {len(profs)} profesionales en {store.name}")
    return profs


async def _seed_services(session: AsyncSession, store: Store, services_data: list) -> list[SchedulingService]:
    svcs = []
    for sdata in services_data:
        r = await session.execute(
            select(SchedulingService).where(
                SchedulingService.store_id == store.id, SchedulingService.slug == sdata["slug"]
            )
        )
        svc = r.scalar_one_or_none()
        if svc:
            svcs.append(svc)
            continue
        svc = SchedulingService(
            id=uid(),
            store_id=store.id,
            name=sdata["name"],
            slug=sdata["slug"],
            category=sdata.get("category"),
            menu_sort_order=sdata.get("menu_sort_order", 0),
            description=sdata.get("description"),
            duration_minutes=sdata["duration_minutes"],
            buffer_before_minutes=5,
            buffer_after_minutes=5,
            price_cents=sdata["price_cents"],
            currency="CLP",
            cancellation_hours=24,
            is_active=True,
        )
        session.add(svc)
        await session.flush()
        svcs.append(svc)
    print(f"    [+] {len(svcs)} servicios en {store.name}")
    return svcs


async def _link_prof_branch(session: AsyncSession, prof: Professional, branch: Branch, is_primary: bool = True):
    r = await session.execute(
        select(ProfessionalBranch).where(
            ProfessionalBranch.professional_id == prof.id,
            ProfessionalBranch.branch_id == branch.id,
        )
    )
    if r.scalar_one_or_none() is None:
        session.add(ProfessionalBranch(
            id=uid(), professional_id=prof.id, branch_id=branch.id, is_primary=is_primary
        ))
        await session.flush()


async def _link_prof_service(session: AsyncSession, prof: Professional, svc: SchedulingService, commission: float = 30.0):
    r = await session.execute(
        select(ProfessionalService).where(
            ProfessionalService.professional_id == prof.id,
            ProfessionalService.service_id == svc.id,
        )
    )
    if r.scalar_one_or_none() is None:
        session.add(ProfessionalService(
            id=uid(), professional_id=prof.id, service_id=svc.id, commission_percent=commission
        ))
        await session.flush()


async def _seed_availability(session: AsyncSession, prof: Professional, branch: Branch):
    r = await session.execute(
        select(AvailabilityRule).where(
            AvailabilityRule.professional_id == prof.id,
            AvailabilityRule.branch_id == branch.id,
        )
    )
    if r.scalars().first():
        return
    # L-V 9-19, S 9-14
    for wd in range(0, 5):
        session.add(AvailabilityRule(
            id=uid(), professional_id=prof.id, branch_id=branch.id,
            rule_type=AvailabilityRuleType.WEEKLY.value, weekday=wd,
            start_time=time(9, 0), end_time=time(19, 0), is_closed=False,
        ))
    session.add(AvailabilityRule(
        id=uid(), professional_id=prof.id, branch_id=branch.id,
        rule_type=AvailabilityRuleType.WEEKLY.value, weekday=5,
        start_time=time(9, 0), end_time=time(14, 0), is_closed=False,
    ))
    session.add(AvailabilityRule(
        id=uid(), professional_id=prof.id, branch_id=branch.id,
        rule_type=AvailabilityRuleType.WEEKLY.value, weekday=6,
        start_time=None, end_time=None, is_closed=True,
    ))
    await session.flush()


async def _seed_clients(session: AsyncSession, store: Store, n: int = 40) -> list[Client]:
    existing = await session.execute(select(Client).where(Client.store_id == store.id))
    ex_list = existing.scalars().all()
    if len(ex_list) >= n:
        return list(ex_list)

    needed = n - len(ex_list)
    used_names = {c.name for c in ex_list}
    available = [nm for nm in NOMBRES if nm not in used_names]
    # Si necesitamos más que los disponibles, generamos variantes
    extra = []
    idx = 0
    while len(available) + len(extra) < needed:
        extra.append(f"{NOMBRES[idx % len(NOMBRES)]} {idx + 2}")
        idx += 1
    pool = available + extra

    new_clients = []
    region, comuna = random.choice(ALL_COMUNAS)
    for name in pool[:needed]:
        c = Client(
            id=uid(),
            store_id=store.id,
            name=name,
            email=f"{slugify(name).replace('-', '.')}@gmail.com",
            phone=rnd_phone(),
            address=f"Calle Los Robles {random.randint(10, 999)}, {comuna}",
            notes=random.choice([None, "Cliente frecuente", "Alérgico a colorantes", "Prefiere citas mañana"]),
            preferences={},
            custom_fields={},
        )
        session.add(c)
        new_clients.append(c)
    await session.flush()
    all_clients_r = await session.execute(select(Client).where(Client.store_id == store.id))
    result = list(all_clients_r.scalars().all())
    print(f"    [+] {len(result)} clientes en {store.name}")
    return result


async def _seed_products(session: AsyncSession, store: Store, products_data: list, branches: list[Branch]) -> list[Product]:
    prods = []
    for pdata in products_data:
        r = await session.execute(
            select(Product).where(Product.store_id == store.id, Product.sku == pdata["sku"])
        )
        prod = r.scalar_one_or_none()
        if prod:
            prods.append(prod)
            continue
        prod = Product(
            id=uid(),
            store_id=store.id,
            name=pdata["name"],
            sku=pdata["sku"],
            price=pdata["price"],
            stock=pdata["stock"],
            category=pdata.get("category"),
            lead_time_days=3,
            stock_status="ok",
        )
        session.add(prod)
        await session.flush()

        # Stock por sede
        for b in branches:
            rb = await session.execute(
                select(ProductBranchStock).where(
                    ProductBranchStock.product_id == prod.id,
                    ProductBranchStock.branch_id == b.id,
                )
            )
            if rb.scalar_one_or_none() is None:
                session.add(ProductBranchStock(
                    id=uid(), product_id=prod.id, branch_id=b.id,
                    quantity=random.randint(0, pdata["stock"]),
                ))
        await session.flush()
        prods.append(prod)
    print(f"    [+] {len(prods)} productos en {store.name}")
    return prods


async def _seed_appointments(
    session: AsyncSession,
    store: Store,
    branch: Branch,
    professionals: list[Professional],
    services: list[SchedulingService],
    clients: list[Client],
    n: int = 80,
) -> list[Appointment]:
    existing = await session.execute(
        select(Appointment).where(Appointment.store_id == store.id, Appointment.branch_id == branch.id)
    )
    ex_appts = existing.scalars().all()
    if len(ex_appts) >= n:
        return list(ex_appts)

    needed = n - len(ex_appts)
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    statuses_past = [
        AppointmentStatus.COMPLETED, AppointmentStatus.COMPLETED, AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW,
    ]
    statuses_future = [
        AppointmentStatus.CONFIRMED, AppointmentStatus.CONFIRMED, AppointmentStatus.CONFIRMED,
        AppointmentStatus.PENDING_PAYMENT,
    ]

    new_appts = []
    for _ in range(needed):
        days_offset = random.randint(-30, 30)
        hour = random.choice([9, 10, 11, 12, 14, 15, 16, 17])
        minute = random.choice([0, 30])
        start = today + timedelta(days=days_offset, hours=hour, minutes=minute)

        svc = random.choice(services)
        end = start + timedelta(minutes=svc.duration_minutes)
        prof = random.choice(professionals)
        client = random.choice(clients)

        if days_offset < 0:
            status = random.choice(statuses_past).value
        else:
            status = random.choice(statuses_future).value

        charged = svc.price_cents if status == AppointmentStatus.COMPLETED.value else None
        session_closed = start + timedelta(minutes=svc.duration_minutes + 5) if status == AppointmentStatus.COMPLETED.value else None

        appt = Appointment(
            id=uid(),
            store_id=store.id,
            branch_id=branch.id,
            professional_id=prof.id,
            service_id=svc.id,
            client_id=client.id,
            start_time=start,
            end_time=end,
            status=status,
            payment_mode=PaymentMode.ON_SITE.value,
            payment_status=PaymentStatus.PAID.value if status == AppointmentStatus.COMPLETED.value else PaymentStatus.NOT_REQUIRED.value,
            manage_token=uid(),
            notes=random.choice([None, None, None, "Sin gluten", "Llegó puntual", "Solicita música suave"]),
            charged_price_cents=charged,
            session_closed_at=session_closed,
        )
        session.add(appt)
        new_appts.append(appt)

    await session.flush()
    all_r = await session.execute(
        select(Appointment).where(Appointment.store_id == store.id, Appointment.branch_id == branch.id)
    )
    result = list(all_r.scalars().all())
    print(f"    [+] {len(result)} citas en {store.name}/{branch.name}")
    return result


async def _seed_reviews(session: AsyncSession, store: Store, appointments: list[Appointment], n: int = 20):
    completed = [a for a in appointments if a.status == AppointmentStatus.COMPLETED.value]
    random.shuffle(completed)
    added = 0
    for appt in completed[:n]:
        r = await session.execute(
            select(AppointmentReview).where(AppointmentReview.appointment_id == appt.id)
        )
        if r.scalar_one_or_none():
            continue
        session.add(AppointmentReview(
            id=uid(),
            appointment_id=appt.id,
            store_id=store.id,
            professional_id=appt.professional_id,
            rating=random.choices([3, 4, 5, 5, 5], k=1)[0],
            comment=random.choice(REVIEW_COMMENTS + [None]),
            created_at=appt.end_time + timedelta(hours=random.randint(1, 48)) if appt.end_time else datetime.utcnow(),
        ))
        added += 1
    await session.flush()
    print(f"    [+] {added} reviews en {store.name}")


async def _seed_purchases(
    session: AsyncSession, store: Store, clients: list[Client], products: list[Product],
    branches: list[Branch], n: int = 40,
):
    existing = await session.execute(select(Purchase).where(Purchase.store_id == store.id))
    ex = existing.scalars().all()
    if len(ex) >= n:
        return

    today = datetime.utcnow()
    for _ in range(n - len(ex)):
        prod = random.choice(products)
        client = random.choice(clients)
        branch = random.choice(branches)
        qty = random.randint(1, 3)
        days_back = random.randint(1, 90)
        session.add(Purchase(
            id=uid(),
            store_id=store.id,
            client_id=client.id,
            product_id=prod.id,
            branch_id=branch.id,
            quantity=qty,
            unit_price=prod.price,
            total=round(prod.price * qty, 0),
            sold_at=today - timedelta(days=days_back),
        ))
    await session.flush()
    print(f"    [+] Compras registradas en {store.name}")


async def _seed_tickets(
    session: AsyncSession, store: Store, clients: list[Client], n: int = 25,
):
    existing = await session.execute(select(Ticket).where(Ticket.store_id == store.id))
    ex = existing.scalars().all()
    if len(ex) >= n:
        return

    statuses = list(TicketStatus)
    types_pool = [TicketType.LEAD] * 5 + [TicketType.TASK] * 3 + [TicketType.INCIDENT] * 2 + [TicketType.ORDER]

    for i in range(n - len(ex)):
        t_type = random.choice(types_pool)
        if t_type == TicketType.LEAD:
            title = random.choice(TICKET_TITLES_LEAD)
        elif t_type == TicketType.TASK:
            title = random.choice(TICKET_TITLES_TASK)
        else:
            title = random.choice(TICKET_TITLES_INCIDENT)

        client = random.choice(clients)
        days_back = random.randint(0, 60)
        due = datetime.utcnow() + timedelta(days=random.randint(1, 14))
        session.add(Ticket(
            id=uid(),
            store_id=store.id,
            title=title,
            description=f"Detalle: {title.lower()} - Cliente {client.name}",
            type=t_type,
            status=random.choice(statuses),
            priority=random.choice(["low", "medium", "medium", "high"]),
            client_id=client.id,
            due_date=due,
            created_at=datetime.utcnow() - timedelta(days=days_back),
        ))
    await session.flush()
    print(f"    [+] Tickets registrados en {store.name}")


async def _seed_waitlist(
    session: AsyncSession, store: Store, branch: Branch,
    professionals: list[Professional], services: list[SchedulingService],
    clients: list[Client], n: int = 8,
):
    existing = await session.execute(select(WaitlistEntry).where(WaitlistEntry.store_id == store.id))
    ex = existing.scalars().all()
    if len(ex) >= n:
        return

    today = date.today()
    for _ in range(n - len(ex)):
        prof = random.choice(professionals)
        svc = random.choice(services)
        client = random.choice(clients)
        desired = today + timedelta(days=random.randint(1, 14))
        session.add(WaitlistEntry(
            id=uid(),
            store_id=store.id,
            branch_id=branch.id,
            professional_id=prof.id,
            service_id=svc.id,
            client_id=client.id,
            client_name=client.name,
            client_email=client.email,
            client_phone=client.phone,
            desired_date=desired,
            status="waiting",
        ))
    await session.flush()
    print(f"    [+] Waitlist entries en {store.name}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    print("\n=== SEED DUMMY — RevoTake ===\n")

    async with AsyncSessionLocal() as session:
        # ---- StoreType fallback ----
        r = await session.execute(select(StoreType).where(StoreType.slug == "generic"))
        generic_st = r.scalar_one_or_none()
        if not generic_st:
            print("ERROR: StoreType 'generic' no encontrado. Ejecuta init_db primero.")
            return
        fallback_type_id = generic_st.id

        # ---- 1. Tiendas ----
        print("[1] Tiendas...")
        stores: dict[str, Store] = {}
        for sdata in STORES_DATA:
            store = await _get_or_create_store(session, sdata, fallback_type_id)
            stores[sdata["slug"]] = store

        barberia = stores["barberia-el-maestro"]
        spa = stores["spa-bienestar-aurora"]

        # ---- 2. Usuarios ----
        print("[2] Usuarios...")
        users: dict[str, User] = {}
        for udata in USERS_DATA:
            u = await _get_or_create_user(session, udata)
            users[udata["email"]] = u

        # ---- 3. StoreMember ----
        print("[3] Membresías...")
        await _link_member(session, users["gerente.barberia@demo.cl"].id, barberia.id, StoreMemberRole.ADMIN)
        await _link_member(session, users["recepcion.barberia@demo.cl"].id, barberia.id, StoreMemberRole.SELLER)
        await _link_member(session, users["operador1@demo.cl"].id, barberia.id, StoreMemberRole.OPERATOR)
        await _link_member(session, users["operador3@demo.cl"].id, barberia.id, StoreMemberRole.OPERATOR)
        await _link_member(session, users["gerente.spa@demo.cl"].id, spa.id, StoreMemberRole.ADMIN)
        await _link_member(session, users["recepcion.spa@demo.cl"].id, spa.id, StoreMemberRole.SELLER)
        await _link_member(session, users["operador2@demo.cl"].id, spa.id, StoreMemberRole.OPERATOR)

        await session.commit()

        # ---- 4. Branches ----
        print("[4] Sedes...")
        bar_branches = await _seed_branches(session, barberia, [
            ("Región Metropolitana de Santiago", "Santiago"),
            ("Región del Libertador General Bernardo O'Higgins", "Rancagua"),
        ])
        spa_branches = await _seed_branches(session, spa, [
            ("Región Metropolitana de Santiago", "Providencia"),
            ("Región Metropolitana de Santiago", "Las Condes"),
            ("Región del Biobío", "Concepción"),
        ])
        await session.commit()

        # ---- 5. WorkStations ----
        print("[5] Estaciones de trabajo...")
        for b in bar_branches:
            await _seed_work_stations(session, barberia, b, n_chairs=4, n_rooms=0)
        for b in spa_branches:
            await _seed_work_stations(session, spa, b, n_chairs=2, n_rooms=3)
        await session.commit()

        # ---- 6. Professionals ----
        print("[6] Profesionales...")
        bar_prof_names = ["Hernán Fuentes", "Jorge Molina", "Luis Sepúlveda", "Pedro Valenzuela", "René Guajardo"]
        spa_prof_names = ["Carolina Mansilla", "Paula Riveros", "Andrea Lizama", "Francisca Bello", "Marcela Orellana", "Daniela Peña"]

        bar_profs = await _seed_professionals(session, barberia, bar_prof_names)
        spa_profs = await _seed_professionals(session, spa, spa_prof_names)
        await session.commit()

        # ---- 7. Servicios ----
        print("[7] Servicios...")
        bar_svcs = await _seed_services(session, barberia, BARBERIA_SERVICIOS)
        spa_svcs = await _seed_services(session, spa, SPA_SERVICIOS)
        await session.commit()

        # ---- 8. ProfessionalBranch ----
        print("[8] Profesionales → Sedes...")
        for prof in bar_profs:
            for idx, b in enumerate(bar_branches):
                await _link_prof_branch(session, prof, b, is_primary=(idx == 0))
        for prof in spa_profs:
            for idx, b in enumerate(spa_branches):
                await _link_prof_branch(session, prof, b, is_primary=(idx == 0))
        await session.commit()

        # ---- 9. ProfessionalService ----
        print("[9] Profesionales → Servicios...")
        for prof in bar_profs:
            for svc in random.sample(bar_svcs, min(5, len(bar_svcs))):
                await _link_prof_service(session, prof, svc, commission=30.0)
        for prof in spa_profs:
            for svc in random.sample(spa_svcs, min(6, len(spa_svcs))):
                await _link_prof_service(session, prof, svc, commission=35.0)
        await session.commit()

        # ---- 10. AvailabilityRules ----
        print("[10] Reglas de disponibilidad...")
        for prof in bar_profs:
            for b in bar_branches:
                await _seed_availability(session, prof, b)
        for prof in spa_profs:
            for b in spa_branches:
                await _seed_availability(session, prof, b)
        await session.commit()

        # ---- 11. Clientes ----
        print("[11] Clientes...")
        bar_clients = await _seed_clients(session, barberia, n=40)
        spa_clients = await _seed_clients(session, spa, n=35)
        await session.commit()

        # ---- 12. Productos ----
        print("[12] Productos...")
        bar_products = await _seed_products(session, barberia, BARBERIA_PRODUCTOS, bar_branches)
        spa_products = await _seed_products(session, spa, SPA_PRODUCTOS, spa_branches)
        await session.commit()

        # ---- 13. Citas ----
        print("[13] Citas...")
        bar_appts = await _seed_appointments(
            session, barberia, bar_branches[0], bar_profs, bar_svcs, bar_clients, n=80
        )
        spa_appts = await _seed_appointments(
            session, spa, spa_branches[0], spa_profs, spa_svcs, spa_clients, n=70
        )
        await session.commit()

        # ---- 14. Reviews ----
        print("[14] Reviews...")
        await _seed_reviews(session, barberia, bar_appts, n=20)
        await _seed_reviews(session, spa, spa_appts, n=18)
        await session.commit()

        # ---- 15. Compras ----
        print("[15] Compras...")
        await _seed_purchases(session, barberia, bar_clients, bar_products, bar_branches, n=40)
        await _seed_purchases(session, spa, spa_clients, spa_products, spa_branches, n=35)
        await session.commit()

        # ---- 16. Tickets ----
        print("[16] Tickets...")
        await _seed_tickets(session, barberia, bar_clients, n=25)
        await _seed_tickets(session, spa, spa_clients, n=20)
        await session.commit()

        # ---- 17. Waitlist ----
        print("[17] Lista de espera...")
        await _seed_waitlist(session, barberia, bar_branches[0], bar_profs, bar_svcs, bar_clients, n=8)
        await _seed_waitlist(session, spa, spa_branches[0], spa_profs, spa_svcs, spa_clients, n=6)
        await session.commit()

    print("\n=== SEED COMPLETADO ===")
    print("Tiendas: Barbería El Maestro, Spa & Bienestar Aurora")
    print("Usuarios demo: gerente.barberia@demo.cl, gerente.spa@demo.cl / password: demo1234")
    print("Todos los datos son idempotentes: puedes re-ejecutar sin duplicar.\n")


if __name__ == "__main__":
    asyncio.run(main())
