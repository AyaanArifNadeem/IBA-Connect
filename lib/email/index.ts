import "server-only";

export type EmailMessage = {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/** Transactional email through Brevo's HTTP API (decided 17 Nov 2026). */
export class BrevoSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: { email: string; name: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await this.fetchImpl(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": this.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: this.from,
        to: [message.to],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
    });
    if (!response.ok) {
      // Do not log the message body or recipient (NFR18)
      throw new Error(`Brevo rejected the email (HTTP ${response.status}).`);
    }
  }
}

/** Development stand-in: prints the subject only, so nothing is sent. */
export class ConsoleSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    console.info(`[email] (not sent, no BREVO_API_KEY) "${message.subject}"`);
  }
}

let sender: EmailSender | undefined;

/** Brevo when configured; otherwise the console sender outside production. */
export function getEmailSender(): EmailSender {
  if (sender) return sender;
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM_ADDRESS;
  if (apiKey && fromEmail) {
    sender = new BrevoSender(apiKey, { email: fromEmail, name: process.env.EMAIL_FROM_NAME ?? "IBA Connect" });
  } else if (process.env.NODE_ENV === "production" && !process.env.CI) {
    throw new Error("BREVO_API_KEY and EMAIL_FROM_ADDRESS must be set in production.");
  } else {
    sender = new ConsoleSender();
  }
  return sender;
}

/** For tests: replace the sender. */
export function setEmailSender(next: EmailSender | undefined) {
  sender = next;
}
