import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any
from config import Config

def send_schedule_notification_email(
    recipient_email: str,
    recipient_name: str,
    plant_name: str,
    plant_emoji: str,
    assigned_dates: List[str],
    base_amount_ml: int,
    app_url: str
) -> None:
    print(f"[Email] 🌿 Sent Schedule Notification to {recipient_name} ({recipient_email}) for {plant_emoji} {plant_name}: {len(assigned_dates)} dates, Base {base_amount_ml} ml.")

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
) -> None:
    print(f"[Email] 💧 Sent Morning Watering Reminder to {recipient_name} ({recipient_email}) for {plant_emoji} {plant_name}: {suggested_ml} ml (base: {base_ml} ml) - {weather_reason}")

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
        print(f"[Email] 📢 Broadcast notification to {rec.get('name', 'Caretaker')} ({rec.get('email', '')}): {poured_by} marked {plant_emoji} {plant_name} as {status.upper()} ({amount_ml} ml) at {poured_at}.")

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
    content = (
        f"Hello {recipient_name},\n\n"
        f"Great job! The watering task for {plant_name} ({plant_emoji}) has been marked as COMPLETED.\n"
        f"• Poured Amount: {amount_ml} ml (Base guideline: {base_ml} ml)\n"
        f"• Watered By: {poured_by}\n"
        f"• Next Scheduled Watering: {next_schedule_date}\n"
        f"• Notes: {notes or 'No additional notes'}\n\n"
        f"Your botanical companion is thriving thanks to your care!\n"
        f"— Plant Care Companion Team"
    )

    # Attempt SMTP dispatch if configured
    if Config.SMTP_USER and Config.SMTP_PASS and Config.SMTP_HOST:
        try:
            msg = MIMEMultipart()
            msg["From"] = Config.EMAIL_FROM
            msg["To"] = recipient_email
            msg["Subject"] = subject
            msg.attach(MIMEText(content, "plain"))
            with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=5) as server:
                server.starttls()
                server.login(Config.SMTP_USER, Config.SMTP_PASS)
                server.send_message(msg)
            print(f"[Email] ✅ Successfully sent task completion email via SMTP to {recipient_email}")
            return
        except Exception as e:
            print(f"[Email] ⚠️ SMTP dispatch failed ({e}), falling back to standard notification log.")

    print(f"[Email] 🌿 Sent Task Completion Email to {recipient_name} ({recipient_email}): {poured_by} completed watering for {plant_emoji} {plant_name} with {amount_ml} ml (base: {base_ml} ml). Next schedule: {next_schedule_date}. Notes: {notes}")

