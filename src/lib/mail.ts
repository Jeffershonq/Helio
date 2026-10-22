import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

let transport: Transporter | undefined;

export async function sendMail(msg: { to: string; subject: string; text: string; html: string }) {
  const e = env();
  if (!e.SMTP_HOST) {
    if (e.NODE_ENV === "production") {
      console.error(`SMTP_HOST is not set, so an email to ${msg.to} was not sent`);
    } else {
      console.log(`\n[mail:dev] to=${msg.to}\nsubject=${msg.subject}\n${msg.text}\n`);
    }
    return;
  }
  transport ??= nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_PORT === 465,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: e.MAIL_FROM, ...msg });
}

function layout(heading: string, paragraphs: string[], cta?: { label: string; url: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.55">${escapeHtml(p)}</p>`).join("");
  const button = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="background:#E8A33D;color:#0B0E1A;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(cta.label)}</a></p>
       <p style="margin:0;font-size:13px;color:#5b6070">Or paste this link into your browser:<br>${escapeHtml(cta.url)}</p>`
    : "";
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0B0E1A">
    <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>${body}${button}</div>`;
  const text = [heading, "", ...paragraphs, ...(cta ? ["", `${cta.label}: ${cta.url}`] : [])].join("\n");
  return { html, text };
}

export const emails = {
  verify: (name: string, url: string) => ({
    subject: "Confirm your email for Helio",
    ...layout(`Welcome to Helio, ${name}`, ["Confirm your email address to finish creating your account. The link works for 24 hours."], {
      label: "Confirm email",
      url,
    }),
  }),
  accountExists: (url: string) => ({
    subject: "You already have a Helio account",
    ...layout("You already have an account", [
      "Someone tried to create a Helio account with this email address. If that was you, sign in instead. If you forgot your password, you can reset it.",
    ], { label: "Go to sign in", url }),
  }),
  reset: (url: string) => ({
    subject: "Reset your Helio password",
    ...layout("Reset your password", [
      "Use the link below to choose a new password. It works for one hour. If you did not ask for this, you can ignore this email.",
    ], { label: "Choose a new password", url }),
  }),
  invite: (inviter: string, workspace: string, role: string, url: string) => ({
    subject: `${inviter} invited you to ${workspace} on Helio`,
    ...layout(`Join ${workspace}`, [
      `${inviter} invited you to the ${workspace} workspace as ${role.toLowerCase()}. The invite works for 7 days.`,
    ], { label: "Accept invite", url }),
  }),
};
