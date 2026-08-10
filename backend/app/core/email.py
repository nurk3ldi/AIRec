from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from anyio import to_thread

from app.core.config import settings

logger = logging.getLogger(__name__)

# Same tokens as frontend/src/styles/globals.css's `@theme` block — kept in
# sync by hand, since an email template can't import Tailwind config.
_BRAND_BLUE = "#3248F2"
_BRAND_BLACK = "#171215"
_BRAND_GRAY = "#999999"
_BRAND_SOFT = "#F6F8FA"


def _send_sync(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from
    message["To"] = to_email
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_user and settings.smtp_password:
            smtp.login(settings.smtp_user, settings.smtp_password.get_secret_value())
        smtp.send_message(message)


def _reset_code_html(code: str, ttl_minutes: int) -> str:
    # Table layout + inline styles throughout, on purpose: email clients (esp.
    # Outlook) strip <style> blocks and ignore flexbox/grid, so this can't be
    # written like the rest of the app's Tailwind markup.
    digits = "".join(
        f'<td width="44" style="width:44px;height:56px;background-color:{_BRAND_SOFT};'
        f'border-radius:10px;text-align:center;font-size:28px;font-weight:700;'
        f'color:{_BRAND_BLACK};font-family:Arial,Helvetica,sans-serif;">{digit}</td>'
        + ('<td width="8"></td>' if i < len(code) - 1 else "")
        for i, digit in enumerate(code)
    )
    return f"""\
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:{_BRAND_SOFT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{_BRAND_SOFT};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;background-color:#ffffff;border-radius:16px;border:1px solid rgba(153,153,153,0.25);">
            <tr>
              <td style="padding:36px 32px 0 32px;text-align:center;">
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:{_BRAND_BLACK};letter-spacing:-0.02em;">AIRec</span>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 4px 32px;text-align:center;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:{_BRAND_BLACK};">Код для восстановления пароля</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0 32px;text-align:center;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:{_BRAND_GRAY};">Введите этот код, чтобы задать новый пароль в AIRec.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;text-align:center;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>{digits}</tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 36px 32px;text-align:center;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{_BRAND_GRAY};">
                  Код действует {ttl_minutes} минут. Если вы не запрашивали восстановление, просто проигнорируйте это письмо.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background-color:{_BRAND_SOFT};border-top:1px solid rgba(153,153,153,0.25);border-radius:0 0 16px 16px;text-align:center;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:{_BRAND_GRAY};">AIRec</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


async def send_password_reset_email(to_email: str, code: str) -> None:
    ttl_minutes = settings.password_reset_code_ttl_minutes
    subject = "Код для восстановления пароля AIRec"
    text_body = (
        f"Ваш код для восстановления пароля: {code}\n\n"
        f"Код действует {ttl_minutes} минут. "
        "Если вы не запрашивали восстановление, просто проигнорируйте это письмо."
    )

    if not settings.smtp_host:
        # No SMTP configured — this is the expected local-dev state. Logging the
        # code is what makes the flow testable without setting up a mail server.
        logger.warning(
            "SMTP not configured — password reset code for %s: %s", to_email, code
        )
        return

    html_body = _reset_code_html(code, ttl_minutes)

    # smtplib is blocking; running it inline would stall the event loop for
    # every concurrent request, same reasoning as Argon2 in core/security.py.
    await to_thread.run_sync(_send_sync, to_email, subject, text_body, html_body)
