/**
 * Email dispatch service for administrative security notifications and OTP codes.
 */
export async function sendAdminOtpEmail(
  to: string,
  code: string,
  purpose: "EMAIL_CHANGE" | "PASSWORD_RESET"
): Promise<boolean> {
  const subject =
    purpose === "EMAIL_CHANGE"
      ? "Confirm your new administrator email address"
      : "Reset your administrator password";

  const message =
    purpose === "EMAIL_CHANGE"
      ? `Your verification code to change your administrator email address is: ${code}. This code expires in 10 minutes.`
      : `Your verification code to reset your administrator password is: ${code}. This code expires in 10 minutes.`;

  // Safe developer/staging logger
  console.log(`[EMAIL DISPATCH] To: ${to} | Subject: ${subject} | Code: [SECURE OTP DISPATCHED]`);

  // If external provider (e.g. Resend, SendGrid, SMTP) is configured in environment, dispatch here
  if (process.env.RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "Love Kitchen Security <security@lovekitchen.ma>",
          to: [to],
          subject,
          text: message,
        }),
      });
    } catch (err) {
      console.error("External email dispatch failed:", err);
    }
  }

  return true;
}

export async function sendPasswordResetOtpEmail(to: string, code: string): Promise<boolean> {
  return sendAdminOtpEmail(to, code, "PASSWORD_RESET");
}

export async function sendEmailVerificationOtp(to: string, code: string): Promise<boolean> {
  return sendAdminOtpEmail(to, code, "EMAIL_CHANGE");
}

export async function sendSecurityAlertEmail(
  to: string,
  subject: string,
  message: string
): Promise<boolean> {
  console.log(`[SECURITY ALERT EMAIL] To: ${to} | Subject: ${subject}`);
  if (process.env.RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "Love Kitchen Security <security@lovekitchen.ma>",
          to: [to],
          subject,
          text: message,
        }),
      });
    } catch (err) {
      console.error("External email dispatch failed:", err);
    }
  }
  return true;
}
