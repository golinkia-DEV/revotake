import logging

import emails

from app.core.config import settings

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    return bool(settings.SMTP_USER and settings.SMTP_PASSWORD)


def send_html_email(to: str, subject: str, html: str) -> bool:
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
