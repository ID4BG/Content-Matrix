import nodemailer from "nodemailer";
import { logger } from "./lib/logger";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER ?? "noreply@contentmatrix.app";

function createTransport() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendReviewNotification(opts: {
  to: string;
  reviewerName: string;
  pieceTitle: string;
  campaignTitle: string;
  note?: string | null;
  pieceUrl?: string;
}) {
  const transport = createTransport();
  if (!transport) {
    logger.info({ to: opts.to, pieceTitle: opts.pieceTitle }, "Email not configured — skipping review notification");
    return;
  }

  const noteHtml = opts.note ? `<p style="margin:16px 0;color:#555;font-style:italic;">"${opts.note}"</p>` : "";
  const linkHtml = opts.pieceUrl
    ? `<p><a href="${opts.pieceUrl}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;font-family:Montserrat,sans-serif;font-size:13px;font-weight:600;letter-spacing:1px;display:inline-block;">REVIEW PIECE</a></p>`
    : "";

  await transport.sendMail({
    from: `Content Matrix <${SMTP_FROM}>`,
    to: opts.to,
    subject: `Review requested: "${opts.pieceTitle}" — ${opts.campaignTitle}`,
    html: `
      <div style="font-family:Montserrat,Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;padding:32px;">
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;letter-spacing:-0.5px;">Review Requested</h2>
        <p style="color:#6b7280;font-size:13px;margin:0 0 24px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Content Matrix</p>
        <p style="margin:0 0 12px;">Hi ${opts.reviewerName},</p>
        <p style="margin:0 0 12px;">A content piece has been submitted for your review:</p>
        <div style="border:1px solid #e5e7eb;padding:16px;margin:16px 0;">
          <p style="margin:0 0 4px;font-weight:700;">${opts.pieceTitle}</p>
          <p style="margin:0;color:#6b7280;font-size:13px;">Campaign: ${opts.campaignTitle}</p>
        </div>
        ${noteHtml}
        ${linkHtml}
        <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">You are receiving this because you are a reviewer on this campaign.</p>
      </div>
    `,
  });

  logger.info({ to: opts.to, pieceTitle: opts.pieceTitle }, "Review notification sent");
}

export async function sendInviteEmail(opts: {
  to: string;
  inviteeName?: string;
  campaignTitle?: string;
  folderName?: string;
  appUrl: string;
  role: string;
}) {
  const transport = createTransport();
  if (!transport) {
    logger.info({ to: opts.to }, "Email not configured — skipping invite email");
    return;
  }

  const scope = opts.folderName
    ? `the folder <strong>${opts.folderName}</strong>`
    : `the campaign <strong>${opts.campaignTitle ?? "a campaign"}</strong>`;

  const greeting = opts.inviteeName ? `Hi ${opts.inviteeName},` : "Hi,";
  const roleLabel = opts.role.replace(/_/g, " ");

  const subject = opts.folderName
    ? `You've been invited to "${opts.folderName}" on Content Matrix`
    : `You've been invited to "${opts.campaignTitle ?? "a campaign"}" on Content Matrix`;

  await transport.sendMail({
    from: `Content Matrix <${SMTP_FROM}>`,
    to: opts.to,
    subject,
    html: `
      <div style="font-family:Montserrat,Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;padding:32px;">
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;letter-spacing:-0.5px;">You're Invited</h2>
        <p style="color:#6b7280;font-size:13px;margin:0 0 24px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Content Matrix</p>
        <p style="margin:0 0 12px;">${greeting}</p>
        <p style="margin:0 0 16px;">You have been invited to collaborate on ${scope} as <strong>${roleLabel}</strong>.</p>
        <p style="margin:16px 0;">
          <a href="${opts.appUrl}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;font-family:Montserrat,sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;display:inline-block;">OPEN CONTENT MATRIX</a>
        </p>
        <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">
          Sign in or create an account using this email address (${opts.to}) to accept the invitation and see your campaigns automatically.
        </p>
      </div>
    `,
  });

  logger.info({ to: opts.to, scope: opts.folderName ?? opts.campaignTitle }, "Invite email sent");
}
