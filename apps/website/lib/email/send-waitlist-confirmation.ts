import { Resend } from "resend";
import {
  getWaitlistConfirmationEmail,
  WAITLIST_FROM,
  WAITLIST_SUBJECT,
} from "./waitlist-confirmation.ts";

export async function sendWaitlistConfirmation(email: string) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error("Waitlist confirmation email skipped: RESEND_API_KEY is missing.");
    return false;
  }

  try {
    const resend = new Resend(apiKey);
    const { html, text } = getWaitlistConfirmationEmail();

    const { data, error } = await resend.emails.send({
      from: WAITLIST_FROM,
      to: email,
      subject: WAITLIST_SUBJECT,
      html,
      text,
    });

    if (error) {
      console.error("Waitlist confirmation email failed:", error);
      return false;
    }

    console.info("Waitlist confirmation email accepted by Resend:", {
      id: data?.id,
    });
    return true;
  } catch (error) {
    console.error("Waitlist confirmation email exception:", error);
    return false;
  }
}
