import logging

import emails
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def smtp_configured() -> bool:
    return bool(settings.SMTP_USER and settings.SMTP_PASSWORD)


def resend_configured() -> bool:
    return bool(settings.RESEND_API_KEY.strip())


def mail_configured() -> bool:
    """True si hay Resend (API) o SMTP listo para enviar."""
    return resend_configured() or smtp_configured()


def _send_via_resend(to: str, subject: str, html: str) -> bool:
    key = settings.RESEND_API_KEY.strip()
    from_addr = settings.RESEND_FROM_EMAIL.strip()
    if not key:
        return False
    if not from_addr:
        logger.error("RESEND_API_KEY está definido pero falta RESEND_FROM_EMAIL (remitente verificado en Resend)")
        return False
    try:
        with httpx.Client(timeout=30.0) as client:
            r = client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": from_addr,
                    "to": [to.strip()],
                    "subject": subject,
                    "html": html,
                },
            )
        if r.status_code not in (200, 201):
            logger.error("Resend rechazó el envío a %s: HTTP %s %s", to, r.status_code, r.text)
            return False
        return True
    except Exception:
        logger.exception("Error Resend al enviar a %s", to)
        return False


def _send_via_smtp(to: str, subject: str, html: str) -> bool:
    if not smtp_configured():
        logger.warning("SMTP no configurado; no se envía correo a %s", to)
        return False
    mail_from = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    try:
        message = emails.Message(subject=subject, mail_from=mail_from)
        message.attach(html=html)
        response = message.send(
            to=to,
            smtp={
                "host": settings.SMTP_HOST,
                "port": settings.SMTP_PORT,
                "user": settings.SMTP_USER,
                "password": settings.SMTP_PASSWORD,
                "tls": True,
            },
        )
        code = getattr(response, "status_code", None)
        if code is not None and code not in (200, 250):
            logger.error("Fallo envío SMTP a %s: status=%s body=%s", to, code, response)
            return False
        return True
    except Exception:
        logger.exception("Error SMTP al enviar a %s", to)
        return False


def send_html_email(to: str, subject: str, html: str) -> bool:
    """
    Envía HTML. Si existe RESEND_API_KEY se usa Resend; si no, SMTP (Gmail u otro).
    """
    if resend_configured():
        return _send_via_resend(to, subject, html)
    return _send_via_smtp(to, subject, html)
