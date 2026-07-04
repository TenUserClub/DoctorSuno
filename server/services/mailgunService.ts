import axios from "axios";

/**
 * Mailgun Service
 * ---------------
 * Sends medical summaries via email using the Mailgun API.
 */

export async function sendEmailSummary(
  email: string,
  summary: string,
  html?: string
): Promise<any> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const fromEmail = process.env.MAILGUN_FROM_EMAIL || `DocScribe <noreply@${domain}>`;

  if (!apiKey || !domain || apiKey === "your_mailgun_api_key" || domain === "your_mailgun_domain") {
    throw new Error(
      "Mailgun credentials are not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN in .env"
    );
  }

  const auth = Buffer.from(`api:${apiKey}`).toString("base64");
  const url = `https://api.mailgun.net/v3/${domain}/messages`;

  const formData = new URLSearchParams();
  formData.append("from", fromEmail);
  formData.append("to", email);
  formData.append("subject", "Medical Consultation Summary");
  formData.append("text", summary);
  
  if (html) {
    formData.append("html", html);
  }

  console.log(`[Mailgun] Sending email to ${email}…`);

  try {
    const response = await axios.post(url, formData, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    console.log(`[Mailgun] Email sent successfully. ID: ${response.data.id}`);
    return response.data;
  } catch (error: any) {
    console.error("[Mailgun] Error sending email:", error.response?.data || error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
