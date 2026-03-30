"""
Tipos de tienda orientados a belleza, bienestar, salud y citas profesionales.
Orden aproximado por frecuencia de uso en plataformas de agenda (referencia interna).
"""


def store_type_seeds_for_wellness(_s):
    return [
        {
            "name": "Centro de estética",
            "slug": "centro-estetica",
            "description": "Tratamientos faciales, corporales y estética avanzada.",
            "icon": "sparkles",
            "default_settings": _s(
                "Centro de estética: tratamientos faciales y corporales, valoraciones, paquetes y citas con seguimiento del cliente.",
                45,
            ),
        },
        {
            "name": "Barbería",
            "slug": "barberia",
            "description": "Cortes, barba y servicios de grooming masculino.",
            "icon": "scissors",
            "default_settings": _s(
                "Barbería: cortes, barba, degradés y tratamientos capilares masculinos. Citas y fidelización.",
                30,
            ),
        },
        {
            "name": "Centro médico",
            "slug": "centro-medico",
            "description": "Atención médica ambulatoria y derivaciones.",
            "icon": "stethoscope",
            "default_settings": _s(
                "Centro médico: agenda de consultas, fichas de pacientes y coordinación de especialidades.",
                30,
            ),
        },
        {
            "name": "Centro de manicure y pedicure",
            "slug": "manicure-pedicure",
            "description": "Uñas esculpidas, semipermanente y cuidado de pies.",
            "icon": "hand",
            "default_settings": _s(
                "Salón de uñas: manicure, pedicure, esculpido y nail art. Citas por servicio y duración.",
                60,
            ),
        },
        {
            "name": "Peluquería",
            "slug": "peluqueria",
            "description": "Corte, color, peinados y tratamientos capilares.",
            "icon": "scissors",
            "default_settings": _s(
                "Peluquería: cortes, coloración, peinados y alisados. Agenda por estilista y servicio.",
                45,
            ),
        },
        {
            "name": "Salón de belleza",
            "slug": "salon-belleza",
            "description": "Servicios integrales de imagen y cuidado personal.",
            "icon": "heart",
            "default_settings": _s(
                "Salón de belleza: servicios mixtos de cabello, uñas y estética ligera. Citas y promociones.",
                45,
            ),
        },
        {
            "name": "Centro de Spa",
            "slug": "spa",
            "description": "Masajes, circuitos de agua y rituales de relajación.",
            "icon": "waves",
            "default_settings": _s(
                "Spa: masajes, envolturas, circuitos termales y paquetes de bienestar. Reservas por cabina y duración.",
                60,
            ),
        },
        {
            "name": "Consulta psicológica",
            "slug": "consulta-psicologica",
            "description": "Terapia individual, pareja o familiar.",
            "icon": "brain",
            "default_settings": _s(
                "Consulta psicológica: sesiones de terapia, evaluaciones y seguimiento. Privacidad y recordatorios discretos.",
                50,
            ),
        },
        {
            "name": "Clínica de salud",
            "slug": "clinica-salud",
            "description": "Atención clínica integral y chequeos.",
            "icon": "activity",
            "default_settings": _s(
                "Clínica de salud: consultas, exámenes y seguimiento de pacientes. Agenda multi-profesional.",
                30,
            ),
        },
        {
            "name": "Consultas médicas",
            "slug": "consultas-medicas",
            "description": "Consultas por especialidad médica.",
            "icon": "user-md",
            "default_settings": _s(
                "Consultorio médico: citas por especialidad, previsiones y políticas de cancelación.",
                30,
            ),
        },
        {
            "name": "Centro de fisioterapia",
            "slug": "fisioterapia",
            "description": "Rehabilitación, kinesiología y sesiones de recuperación.",
            "icon": "activity",
            "default_settings": _s(
                "Fisioterapia: evaluaciones, sesiones de rehabilitación y planes de ejercicio. Seguimiento por paciente.",
                45,
            ),
        },
        {
            "name": "Terapia alternativa",
            "slug": "terapia-alternativa",
            "description": "Acupuntura, reiki, flores de Bach y terapias complementarias.",
            "icon": "flower-2",
            "default_settings": _s(
                "Terapias complementarias: sesiones holísticas, paquetes y consentimientos informados.",
                60,
            ),
        },
        {
            "name": "Veterinaria",
            "slug": "veterinaria",
            "description": "Clínica veterinaria y cuidado de mascotas.",
            "icon": "heart",
            "default_settings": _s(
                "Veterinaria: consultas, vacunaciones, cirugías menores y grooming asociado. Ficha por mascota.",
                30,
            ),
        },
        {
            "name": "Estilistas independientes",
            "slug": "estilista-independiente",
            "description": "Profesional autónomo a domicilio o en sala compartida.",
            "icon": "user",
            "default_settings": _s(
                "Estilista independiente: agenda personal, servicios a domicilio o en coworking de belleza.",
                45,
            ),
        },
        {
            "name": "Clínica odontológica",
            "slug": "clinica-odontologica",
            "description": "Odontología general, estética dental e implantes.",
            "icon": "smile",
            "default_settings": _s(
                "Clínica dental: limpiezas, ortodoncia, implantes y urgencias. Ficha clínica y presupuestos.",
                45,
            ),
        },
        {
            "name": "Salón de cejas y pestañas",
            "slug": "cejas-pestanas",
            "description": "Diseño de cejas, laminado, extensiones de pestañas.",
            "icon": "eye",
            "default_settings": _s(
                "Salón de cejas y pestañas: laminado, microblading, lifting y extensiones. Citas por técnica.",
                75,
            ),
        },
        {
            "name": "Centro deportivo",
            "slug": "centro-deportivo",
            "description": "Instalación con clases, canchas o piscina.",
            "icon": "trophy",
            "default_settings": _s(
                "Centro deportivo: reserva de canchas, clases grupales y membresías. Turnos y cupos.",
                60,
            ),
        },
        {
            "name": "Gimnasio",
            "slug": "gimnasio",
            "description": "Sala de entrenamiento, máquinas y asesoría.",
            "icon": "dumbbell",
            "default_settings": _s(
                "Gimnasio: evaluaciones físicas, planes y seguimiento. Citas con entrenadores.",
                60,
            ),
        },
        {
            "name": "Consultorios",
            "slug": "consultorio",
            "description": "Consulta profesional independiente (abogado, contador, etc.).",
            "icon": "briefcase",
            "default_settings": _s(
                "Consultorio profesional: citas de asesoría, seguimiento de casos y documentación.",
                45,
            ),
        },
        {
            "name": "Escuela de meditación y yoga",
            "slug": "meditacion-yoga",
            "description": "Clases de yoga, mindfulness y talleres de bienestar.",
            "icon": "sun",
            "default_settings": _s(
                "Estudio de yoga o meditación: clases grupales, talleres y retiros. Reservas por cupo.",
                60,
            ),
        },
        {
            "name": "Gimnasio CrossFit",
            "slug": "crossfit",
            "description": "Box de CrossFit y WODs guiados.",
            "icon": "zap",
            "default_settings": _s(
                "Box CrossFit: clases WOD, introducciones y open gym. Cupos y niveles.",
                60,
            ),
        },
        {
            "name": "Estudio de danza / baile",
            "slug": "estudio-danza",
            "description": "Clases de baile y ensayos.",
            "icon": "music",
            "default_settings": _s(
                "Estudio de danza: clases por estilo, niveles y ensayos grupales.",
                60,
            ),
        },
        {
            "name": "Personal trainer",
            "slug": "personal-trainer",
            "description": "Entrenamiento personalizado en gimnasio o domicilio.",
            "icon": "target",
            "default_settings": _s(
                "Personal trainer: sesiones one-to-one, planes y seguimiento de objetivos.",
                60,
            ),
        },
        {
            "name": "Otro / personalizar",
            "slug": "generic",
            "description": "Plantilla neutra si tu rubro no está en la lista.",
            "icon": "layout-grid",
            "default_settings": _s(
                "Negocio de citas y atención al cliente: ajustá el contexto en configuración cuando quieras.",
                30,
            ),
        },
    ]
