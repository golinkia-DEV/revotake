"""Templates HTML responsive para emails transaccionales de RevoTake."""
from __future__ import annotations


def _base(
    *,
    store_name: str,
    store_color: str = "#7C3AED",
    title: str,
    preheader: str,
    body_html: str,
    cta_url: str | None = None,
    cta_label: str | None = None,
) -> str:
    cta_block = ""
    if cta_url and cta_label:
        cta_block = f"""
        <tr>
          <td align="center" style="padding:8px 0 24px;">
            <a href="{cta_url}"
               style="display:inline-block;background:{store_color};color:#ffffff;
                      font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;
                      font-weight:700;text-decoration:none;border-radius:999px;
                      padding:14px 32px;letter-spacing:0.3px;">
              {cta_label}
            </a>
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>{title}</title>
  <meta name="x-apple-disable-message-reformatting" />
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f3f0fa;font-family:'Helvetica Neue',Arial,sans-serif;">
<!-- preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{preheader}&nbsp;‌&zwnj;&nbsp;‌</div>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f0fa;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <!-- Contenedor principal -->
      <table width="600" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;width:100%;background:#ffffff;
                    border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(124,58,237,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,{store_color},{store_color}cc);padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <span style="display:inline-block;background:rgba(255,255,255,0.15);
                               border-radius:10px;padding:6px 14px;
                               color:#ffffff;font-size:18px;font-weight:800;
                               letter-spacing:-0.3px;">
                    {store_name}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 8px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;
                       color:#1e1b2e;letter-spacing:-0.5px;line-height:1.3;">
              {title}
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 16px;color:#4b4569;font-size:15px;line-height:1.7;">
            {body_html}
          </td>
        </tr>

        {cta_block}

        <!-- Divider -->
        <tr>
          <td style="padding:0 32px;">
            <hr style="border:none;border-top:1px solid #ede9f9;margin:0;" />
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px 28px;text-align:center;
                     color:#9ca3af;font-size:12px;line-height:1.6;">
            Este email fue enviado por <strong style="color:{store_color};">{store_name}</strong>
            a través de <strong>RevoTake</strong>.<br/>
            Si no agendaste esta cita, ignora este mensaje.
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────────────────────
# Templates por tipo de notificación
# ─────────────────────────────────────────────────────────────────────────────

def booking_confirmation(
    *,
    client_name: str,
    store_name: str,
    store_color: str = "#7C3AED",
    service_name: str,
    professional_name: str,
    branch_name: str,
    start_time_fmt: str,
    deposit_cents: int = 0,
    currency: str = "CLP",
    cancellation_hours: int = 0,
    cancellation_fee_cents: int = 0,
    manage_url: str,
) -> tuple[str, str]:
    """Retorna (subject, html)."""
    subject = f"Cita confirmada: {service_name} — {store_name}"

    detail_rows = f"""
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#f8f5ff;border-radius:12px;margin-bottom:20px;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="6" cellspacing="0" border="0">
            <tr>
              <td width="50%" style="color:#6b7280;font-size:13px;font-weight:600;
                                     text-transform:uppercase;letter-spacing:0.5px;">
                Servicio
              </td>
              <td style="color:#1e1b2e;font-size:14px;font-weight:700;">{service_name}</td>
            </tr>
            <tr>
              <td style="color:#6b7280;font-size:13px;font-weight:600;
                         text-transform:uppercase;letter-spacing:0.5px;">
                Profesional
              </td>
              <td style="color:#1e1b2e;font-size:14px;">{professional_name}</td>
            </tr>
            {"<tr><td style='color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;'>Sede</td><td style='color:#1e1b2e;font-size:14px;'>" + branch_name + "</td></tr>" if branch_name else ""}
            <tr>
              <td style="color:#6b7280;font-size:13px;font-weight:600;
                         text-transform:uppercase;letter-spacing:0.5px;">
                Fecha y hora
              </td>
              <td style="color:#7c3aed;font-size:15px;font-weight:800;">{start_time_fmt}</td>
            </tr>
            {f"<tr><td style='color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;'>Depósito</td><td style='color:#059669;font-size:14px;font-weight:700;'>{deposit_cents // 100:,} {currency}</td></tr>" if deposit_cents > 0 else ""}
          </table>
        </td>
      </tr>
    </table>"""

    policy_note = ""
    if cancellation_hours > 0:
        fee_note = f" Se cobrará {cancellation_fee_cents // 100:,} {currency} por cancelación tardía." if cancellation_fee_cents > 0 else ""
        policy_note = f"""<p style="font-size:13px;color:#6b7280;background:#fefce8;
                            border-left:3px solid #f59e0b;padding:10px 14px;border-radius:4px;margin:0;">
          Política de cancelación: cancela con al menos <strong>{cancellation_hours} horas</strong> de antelación sin costo.{fee_note}
        </p>"""

    body = f"""
    <p>Hola <strong>{client_name}</strong>,</p>
    <p>Tu reserva en <strong>{store_name}</strong> quedó confirmada. Aquí están los detalles:</p>
    {detail_rows}
    {policy_note}"""

    html = _base(
        store_name=store_name,
        store_color=store_color,
        title="¡Reserva confirmada!",
        preheader=f"Tu cita de {service_name} está agendada",
        body_html=body,
        cta_url=manage_url,
        cta_label="Ver / Gestionar mi cita",
    )
    return subject, html


def reminder(
    *,
    client_name: str,
    store_name: str,
    store_color: str = "#7C3AED",
    service_name: str,
    professional_name: str,
    start_time_fmt: str,
    hours_before: int,
    manage_url: str,
) -> tuple[str, str]:
    label = "mañana" if hours_before >= 20 else "en 1 hora"
    subject = f"Recordatorio: tu cita {label} — {service_name}"
    body = f"""
    <p>Hola <strong>{client_name}</strong>,</p>
    <p>Te recordamos que tienes una cita <strong>{label}</strong>:</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#f8f5ff;border-radius:12px;margin:12px 0 20px;">
      <tr>
        <td style="padding:18px 24px;">
          <p style="margin:0 0 6px;font-size:20px;font-weight:800;color:#7c3aed;">{start_time_fmt}</p>
          <p style="margin:0;font-size:14px;color:#4b4569;">
            <strong>{service_name}</strong> con {professional_name}
          </p>
        </td>
      </tr>
    </table>"""
    html = _base(
        store_name=store_name,
        store_color=store_color,
        title=f"Recordatorio: cita {label}",
        preheader=f"{service_name} {label} — {start_time_fmt}",
        body_html=body,
        cta_url=manage_url,
        cta_label="Confirmar asistencia",
    )
    return subject, html


def post_visit_review(
    *,
    client_name: str,
    store_name: str,
    store_color: str = "#7C3AED",
    service_name: str,
    professional_name: str,
    manage_url: str,
) -> tuple[str, str]:
    subject = f"¿Cómo estuvo tu visita? — {store_name}"
    body = f"""
    <p>Hola <strong>{client_name}</strong>,</p>
    <p>Esperamos que tu experiencia de <strong>{service_name}</strong>
       {f"con <strong>{professional_name}</strong>" if professional_name else ""} haya sido excelente.</p>
    <p>Tu opinión nos ayuda a mejorar. ¿Nos dejas una reseña rápida? Solo toma 30 segundos.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#f8f5ff;border-radius:12px;margin:12px 0 20px;text-align:center;">
      <tr>
        <td style="padding:18px 24px;">
          <span style="font-size:32px;">⭐⭐⭐⭐⭐</span>
          <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Haz clic abajo para calificar tu visita</p>
        </td>
      </tr>
    </table>"""
    html = _base(
        store_name=store_name,
        store_color=store_color,
        title="¿Cómo fue tu visita?",
        preheader=f"Cuéntanos tu experiencia en {store_name}",
        body_html=body,
        cta_url=manage_url,
        cta_label="Dejar mi reseña",
    )
    return subject, html


def rebooking_suggestion(
    *,
    client_name: str,
    store_name: str,
    store_color: str = "#7C3AED",
    service_name: str,
    book_url: str,
) -> tuple[str, str]:
    subject = f"Es hora de tu próxima cita — {store_name}"
    body = f"""
    <p>Hola <strong>{client_name}</strong>,</p>
    <p>Han pasado unos días desde tu última visita para <strong>{service_name}</strong>.</p>
    <p>Tenemos disponibilidad esperándote. ¡Agenda fácil en segundos!</p>"""
    html = _base(
        store_name=store_name,
        store_color=store_color,
        title="¿Lista/o para tu próxima visita?",
        preheader=f"Agenda tu próxima cita de {service_name}",
        body_html=body,
        cta_url=book_url,
        cta_label="Reservar ahora",
    )
    return subject, html


def waitlist_slot_available(
    *,
    client_name: str,
    store_name: str,
    store_color: str = "#7C3AED",
    service_name: str,
    date_fmt: str,
    book_url: str,
) -> tuple[str, str]:
    subject = f"¡Hay disponibilidad! — {service_name}"
    body = f"""
    <p>Hola <strong>{client_name}</strong>,</p>
    <p>Buenas noticias: se liberó un espacio para <strong>{service_name}</strong>
       el <strong>{date_fmt}</strong> en {store_name}.</p>
    <p>Los cupos son limitados — reserva ahora antes de que se ocupe.</p>"""
    html = _base(
        store_name=store_name,
        store_color=store_color,
        title="¡Hay un espacio disponible!",
        preheader=f"Se liberó un cupo para {service_name} el {date_fmt}",
        body_html=body,
        cta_url=book_url,
        cta_label="Reservar mi lugar",
    )
    return subject, html
