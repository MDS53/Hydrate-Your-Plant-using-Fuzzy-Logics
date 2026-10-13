import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any, Optional
from config import Config

# Runtime configuration cache
_runtime_smtp: Dict[str, Any] = {}

def get_effective_config() -> Dict[str, Any]:
    service = (_runtime_smtp.get("service") or os.getenv("SMTP_SERVICE") or "").strip()
    host = (_runtime_smtp.get("host") or os.getenv("SMTP_HOST") or "smtp.gmail.com" if service == "gmail" else "smtp.ethereal.email").strip()
    try:
        port = int(_runtime_smtp.get("port") or os.getenv("SMTP_PORT") or (465 if service == "gmail" else 587))
    except Exception:
        port = 587
    user = (_runtime_smtp.get("user") or os.getenv("SMTP_USER") or "").strip()
    password = (_runtime_smtp.get("pass") or os.getenv("SMTP_PASS") or "").strip()
    
    from_addr = (_runtime_smtp.get("from") or os.getenv("EMAIL_FROM") or "").strip()
    if user and "@" in user:
        from_addr = f'"Hydrate your plant using fuzzy logic" <{user}>'
    elif not from_addr:
        from_addr = '"Hydrate your plant using fuzzy logic" <noreply@hydrateplant.app>'

    return {
        "service": service,
        "host": host,
        "port": port,
        "user": user,
        "pass": password,
        "from": from_addr,
        "configured": bool(user and password),
    }

def configure_smtp(settings: Dict[str, Any]) -> None:
    global _runtime_smtp
    _runtime_smtp = {**settings}
    print("[Email] Runtime SMTP configuration updated.")

def get_smtp_status() -> Dict[str, Any]:
    cfg = get_effective_config()
    masked_user = ""
    if cfg["user"]:
        if "@" in cfg["user"]:
            u, d = cfg["user"].split("@", 1)
            masked_user = f"{u[:2]}***@{d}"
        else:
            masked_user = f"{cfg['user'][:2]}***"

    is_ethereal = not cfg["configured"] or "ethereal.email" in cfg["host"]
    return {
        "configured": cfg["configured"],
        "service": cfg["service"],
        "host": cfg["host"],
        "port": cfg["port"],
        "user": masked_user,
        "from": cfg["from"],
        "isEthereal": is_ethereal,
        "lastTestMessageUrl": None,
    }

def _send_smtp_mail(to_email: str, subject: str, html_body: str, text_body: str = "") -> bool:
    cfg = get_effective_config()
    if not cfg["configured"]:
        print(f"[Email] ⚠️ No live SMTP credentials configured. Simulated email to {to_email}: '{subject}'")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = cfg["from"]
        msg["To"] = to_email
        msg["Subject"] = subject

        if text_body:
            msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        if cfg["port"] == 465:
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=10) as server:
                server.login(cfg["user"], cfg["pass"])
                server.send_message(msg)
        else:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=10) as server:
                server.starttls()
                server.login(cfg["user"], cfg["pass"])
                server.send_message(msg)

        print(f"[Email] ✅ Successfully dispatched live email via SMTP to {to_email}")
        return True
    except Exception as e:
        print(f"[Email] ⚠️ SMTP dispatch to {to_email} failed: {e}")
        return False

def verify_smtp() -> Dict[str, Any]:
    cfg = get_effective_config()
    if not cfg["configured"]:
        return {
            "success": True,
            "message": "Demo test mailer active. Configure Gmail or custom SMTP in profile to send live emails.",
            "isEthereal": True,
        }

    try:
        if cfg["port"] == 465:
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=8) as server:
                server.login(cfg["user"], cfg["pass"])
        else:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=8) as server:
                server.starttls()
                server.login(cfg["user"], cfg["pass"])

        return {
            "success": True,
            "message": "SMTP connection verified successfully! Live emails will be delivered.",
            "isEthereal": False,
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to connect to SMTP server: {e}",
            "isEthereal": False,
        }

def send_test_email(to_email: str) -> Dict[str, Any]:
    cfg = get_effective_config()
    subject = "🌱 Test Notification - Hydrate your plant using fuzzy logic"
    html_body = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e7e5e4; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #065f46; margin-top: 0;">🌿 Email Delivery Verified!</h2>
      <p>Congratulations! Your email notification setup for <strong>Hydrate your plant using fuzzy logic</strong> is working seamlessly.</p>
      <p style="font-size: 13px; color: #57534e;">All upcoming watering schedules, time-to-water alerts, and watering confirmations will be safely delivered to this inbox.</p>
      <div style="margin-top: 20px; padding: 12px; background: #f0fdf4; border-radius: 8px; font-size: 12px; color: #166534;">
        Recipient: {to_email} &bull; Status: Active
      </div>
    </div>
    """
    text_body = f"Test Notification from Hydrate your plant using fuzzy logic. Delivery verified for {to_email}."

    delivered = _send_smtp_mail(to_email, subject, html_body, text_body)
    return {
        "success": True,
        "message": f"Test email {'dispatched via SMTP' if delivered else 'simulated'} to {to_email}!",
        "delivered": delivered,
    }

def send_schedule_notification_email(
    recipient_email: str,
    recipient_name: str,
    plant_name: str,
    plant_emoji: str,
    assigned_dates: List[str],
    base_amount_ml: int,
    app_url: str
) -> Dict[str, Any]:
    subject = f"🌿 Upcoming Watering Schedule: {plant_emoji} {plant_name}"
    dates_html = "".join([f"<li style='margin-bottom: 6px;'>📅 {d}</li>" for d in assigned_dates[:7]])
    
    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 40px;">{plant_emoji}</span>
        <h2 style="color: #065f46; margin: 8px 0 4px 0; font-size: 22px;">Upcoming Watering Schedule</h2>
        <p style="color: #64748b; font-size: 13px; margin: 0;">For <strong>{plant_name}</strong></p>
      </div>

      <p style="font-size: 14px; line-height: 1.6;">Hello <strong>{recipient_name}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        Here is the calibrated watering schedule for your botanical companion. Each morning, fuzzy logic dynamically adjusts the hydration volume based on live weather data.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 18px 0;">
        <div style="font-size: 12px; font-weight: bold; color: #065f46; text-transform: uppercase; margin-bottom: 10px;">Scheduled Dates</div>
        <ul style="padding-left: 20px; margin: 0; font-size: 13px; color: #334155;">
          {dates_html}
        </ul>
        <div style="margin-top: 12px; font-size: 12px; color: #64748b; border-top: 1px dashed #cbd5e1; pt: 8px;">
          Base guideline volume: <strong>{base_amount_ml} ml</strong>
        </div>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="{app_url}" style="display: inline-block; padding: 12px 24px; background: #059669; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 13px;">Open Plant Dashboard</a>
      </div>
      
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px;">
        Hydrate your plant using fuzzy logic &bull; Smart Botanical Hydration System
      </p>
    </div>
    """
    text_body = f"Upcoming Watering Schedule for {plant_name}: {', '.join(assigned_dates[:7])}. Base volume: {base_amount_ml} ml. View: {app_url}"

    delivered = _send_smtp_mail(recipient_email, subject, html_body, text_body)
    print(f"[Email] 🌿 Sent Schedule Notification to {recipient_name} ({recipient_email}) for {plant_emoji} {plant_name}: {len(assigned_dates)} dates, Base {base_amount_ml} ml. (Delivered: {delivered})")
    return {"delivered": delivered, "recipient": recipient_email}

def send_watering_reminder_email(
    recipient_email: str,
    recipient_name: str,
    plant_name: str,
    plant_emoji: str,
    suggested_ml: int,
    base_ml: int,
    weather_reason: str,
    weather_badge: Dict[str, str],
    action_url: str
) -> Dict[str, Any]:
    subject = f"💧 Time to Water: {plant_emoji} {plant_name} ({suggested_ml} ml recommended today)"
    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
      <h2 style="color: #065f46; margin-top: 0;">💧 Time to Hydrate {plant_emoji} {plant_name}!</h2>
      <p style="font-size: 14px; color: #334155;">Hello {recipient_name},</p>
      <p style="font-size: 14px; color: #334155;">
        Your fuzzy logic morning schedule recommends <strong>{suggested_ml} ml</strong> (base: {base_ml} ml).
      </p>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px; margin: 16px 0; font-size: 13px; color: #166534;">
        🌤️ Weather Context: {weather_reason}
      </div>
      <a href="{action_url}" style="display: inline-block; padding: 12px 20px; background: #059669; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px;">Confirm Water Pour</a>
    </div>
    """
    text_body = f"Time to water {plant_name}! Suggested: {suggested_ml} ml. Weather note: {weather_reason}. Confirm here: {action_url}"
    delivered = _send_smtp_mail(recipient_email, subject, html_body, text_body)
    print(f"[Email] 💧 Sent Morning Watering Reminder to {recipient_name} ({recipient_email}) for {plant_emoji} {plant_name}: {suggested_ml} ml. (Delivered: {delivered})")
    return {"delivered": delivered, "recipient": recipient_email}

def send_watering_confirmation_notification(
    recipients: List[Dict[str, str]],
    poured_by: str,
    plant_name: str,
    plant_emoji: str,
    amount_ml: int,
    status: str,
    poured_at: str,
    reason: str = ""
) -> None:
    for rec in recipients:
        email = rec.get("email")
        name = rec.get("name", "Caretaker")
        if not email:
            continue
        subject = f"🌿 Task Update: {plant_emoji} {plant_name} marked as {status.upper()}"
        html_body = f"""
        <div style="font-family: -apple-system, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h3 style="color: #065f46; margin-top: 0;">🌿 Watering Update</h3>
          <p style="font-size: 13px; color: #334155;">Hello {name},</p>
          <p style="font-size: 13px; color: #334155;">
            <strong>{poured_by}</strong> completed watering for <strong>{plant_emoji} {plant_name}</strong> with <strong>{amount_ml} ml</strong> at {poured_at}.
          </p>
        </div>
        """
        _send_smtp_mail(email, subject, html_body, f"{poured_by} watered {plant_name} ({amount_ml} ml).")

def send_watering_task_completion_email(
    recipient_email: str,
    recipient_name: str,
    plant_name: str,
    plant_emoji: str,
    amount_ml: int,
    base_ml: int,
    poured_by: str,
    next_schedule_date: str = "Upcoming schedule",
    notes: str = ""
) -> None:
    subject = f"🌿 Task Completed: {plant_emoji} {plant_name} was watered by {poured_by}!"
    html_body = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 520px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h3 style="color: #065f46; margin-top: 0;">🌿 Task Completed!</h3>
      <p style="font-size: 14px; color: #334155;">Hello {recipient_name},</p>
      <p style="font-size: 13px; color: #334155;">
        The watering task for <strong>{plant_name} ({plant_emoji})</strong> was logged by <strong>{poured_by}</strong>:
      </p>
      <ul style="font-size: 13px; color: #475569;">
        <li>Poured: <strong>{amount_ml} ml</strong> (Base: {base_ml} ml)</li>
        <li>Next Schedule: <strong>{next_schedule_date}</strong></li>
        <li>Notes: {notes or 'No notes'}</li>
      </ul>
    </div>
    """
    _send_smtp_mail(recipient_email, subject, html_body, f"{poured_by} watered {plant_name} with {amount_ml} ml.")
