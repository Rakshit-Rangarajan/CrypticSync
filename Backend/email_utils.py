import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

# General SMTP Configuration (Works for Resend, Ethereal, SendGrid, etc.)
# For Ethereal Email (Development):
#   SMTP_HOST = "smtp.ethereal.email"
#   SMTP_PORT = 587
#   SMTP_USER = "your-ethereal-user"
#   SMTP_PASS = "your-ethereal-password"
#   SMTP_USE_TLS = True
#
# For Resend (Production):
#   SMTP_HOST = "smtp.resend.com"
#   SMTP_PORT = 465 (or 587)
#   SMTP_USER = "resend"
#   SMTP_PASS = "your-resend-api-key"
#   SMTP_USE_SSL = True (if port 465)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.ethereal.email")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "True").lower() in ('true', '1', 't')
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "False").lower() in ('true', '1', 't')

def send_reset_email(to_email: str, reset_url: str, user_name: str, is_new_user: bool = False):
    subject = "Welcome to CrypticSync! Set your Password" if is_new_user else "CrypticSync Password Reset Request"
    
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4f46e5;">CrypticSync</h2>
        <p>Hello {user_name},</p>
        <p>{'Welcome to CrypticSync! Your admin has created an account for you. Please set your initial password by clicking the link below:' if is_new_user else 'We received a request to reset your password. Click the link below to choose a new one:'}</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="{reset_url}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            {'Set Password' if is_new_user else 'Reset Password'}
          </a>
        </div>
        
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6b7280; font-size: 14px;">{reset_url}</p>
        
        <p>This link will expire in 1 hour.</p>
        <p>Best regards,<br>The CrypticSync Team</p>
      </body>
    </html>
    """

    if not SMTP_USER or not SMTP_PASS:
        print("\n" + "="*50)
        print(f"EMAIL INTERCEPTED (No SMTP Credentials Configured)")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Reset URL: {reset_url}")
        print("="*50 + "\n")
        return

    msg = MIMEMultipart()
    # Note: For Resend, the sender domain must be verified. 
    # Use 'onboarding@resend.dev' for testing if you haven't verified a domain.
    msg['From'] = "onboarding@resend.dev" if "resend" in SMTP_HOST else "noreply@crypticsync.com"
    msg['To'] = to_email
    msg['Subject'] = subject
    
    msg.attach(MIMEText(html_content, 'html'))

    try:
        if SMTP_USE_SSL:
            # Resend using Port 465 uses SSL directly
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
        else:
            # Ethereal or Resend on Port 587 uses explicit TLS
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                if SMTP_USE_TLS:
                    server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
                
        print(f"Successfully sent email to {to_email} via {SMTP_HOST}.")
    except Exception as e:
        print(f"Failed to send email via SMTP: {str(e)}")
        # Fallback to console print if sending fails
        print(f"Reset URL: {reset_url}")

def send_contact_email(name: str, from_email: str, rating: int, message: str):
    subject = f"New Project Review: {name} ({rating}/5 Stars)"
    target_email = "rakshitr2000@gmail.com"
    
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">New Project Feedback</h2>
        <p><strong>From:</strong> {name} (<a href="mailto:{from_email}">{from_email}</a>)</p>
        <p><strong>Rating:</strong> {'★' * rating}{'☆' * (5 - rating)} ({rating}/5)</p>
        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 20px; font-style: italic;">
          "{message}"
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #9ca3af;">This email was sent from the CrypticSync Landing Page Contact Form.</p>
      </body>
    </html>
    """

    if not SMTP_USER or not SMTP_PASS:
        print("\n" + "!"*50)
        print(f"CONTACT EMAIL INTERCEPTED (No SMTP Config)")
        print(f"To: {target_email}")
        print(f"From: {from_email}")
        print(f"Rating: {rating}")
        print(f"Message: {message}")
        print("!"*50 + "\n")
        return

    msg = MIMEMultipart()
    msg['From'] = "onboarding@resend.dev" if "resend" in SMTP_HOST else "noreply@crypticsync.com"
    msg['To'] = target_email
    msg['Subject'] = subject
    
    msg.attach(MIMEText(html_content, 'html'))

    try:
        if SMTP_USE_SSL:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                if SMTP_USE_TLS:
                    server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
        print(f"Successfully sent contact email to {target_email}.")
    except Exception as e:
        print(f"Failed to send contact email: {str(e)}")

