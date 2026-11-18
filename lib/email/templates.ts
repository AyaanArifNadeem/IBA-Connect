import type { EmailMessage } from "./index";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function layout(title: string, bodyHtml: string, action: { label: string; href: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:24px">
<tr><td style="font-size:18px;font-weight:bold;color:#8b0000;padding-bottom:12px">IBA Connect</td></tr>
<tr><td style="font-size:16px;font-weight:bold;padding-bottom:8px">${escape(title)}</td></tr>
<tr><td style="font-size:14px;line-height:1.5">${bodyHtml}</td></tr>
<tr><td style="padding-top:20px"><a href="${escape(action.href)}" style="display:inline-block;background:#8b0000;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">${escape(action.label)}</a></td></tr>
<tr><td style="padding-top:20px;font-size:12px;color:#6b7280">You get this email because you are a member of IBA Connect.</td></tr>
</table></td></tr></table></body></html>`;
}

/** FR3.6: new connection request. Includes the note, never the requester's email. */
export function connectionRequestEmail(args: {
  to: { email: string; name: string };
  from: string;
  note: string;
  appUrl: string;
}): EmailMessage {
  const link = `${args.appUrl}/requests`;
  return {
    to: { email: args.to.email, name: args.to.name },
    subject: `${args.from} wants to connect on IBA Connect`,
    html: layout(
      `${args.from} wants to connect`,
      `<p>Hi ${escape(args.to.name.split(" ")[0])},</p><p>${escape(args.from)} sent you a connection request:</p>
<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #8b0000;background:#f9fafb">${escape(args.note)}</blockquote>
<p>Accept to start a private chat, or decline. Your email stays hidden unless you accept.</p>`,
      { label: "Open requests", href: link },
    ),
    text: `${args.from} wants to connect on IBA Connect.\n\n"${args.note}"\n\nAccept or decline: ${link}`,
  };
}
