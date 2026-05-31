import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { PLAN_LABELS } from '../leads/leads.schema';
import type { EmailJobData, LeadForEmail } from './email.types';

export type { LeadForEmail };

let transport: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT ?? 587),
      secure: Number(env.SMTP_PORT) === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transport;
}

function fromAddress(label: string): string {
  return env.SMTP_FROM ?? `"${label}" <${env.SMTP_USER}>`;
}

function safeSubject(subject: string): string {
  return subject.replace(/[\r\n]+/g, ' ').trim();
}

export class EmailService {
  async verifyTransport(): Promise<boolean> {
    const smtp = getTransport();
    if (!smtp) return false;
    await smtp.verify();
    return true;
  }

  async processJob(data: EmailJobData): Promise<void> {
    if (data.type === 'lead-notification') {
      await this.sendLeadNotification(data.lead);
      return;
    }
    if (data.type === 'lead-confirmation') {
      await this.sendLeadConfirmation(data.lead);
      return;
    }
    if (data.type === 'custom-email') {
      await this.sendCustomEmail(data.lead, data.subject, data.body);
      return;
    }
    await this.sendPasswordReset(data.recipient, data.adminName, data.resetUrl);
  }

  private async send(options: SendMailOptions, required = false): Promise<boolean> {
    const smtp = getTransport();
    if (!smtp) {
      if (required) throw new Error('SMTP is not configured');
      console.warn('SMTP not configured - skipping email send');
      return false;
    }

    await smtp.sendMail(options);
    return true;
  }

  async sendLeadNotification(lead: LeadForEmail): Promise<void> {
    const recipient = env.NOTIFICATION_EMAIL ?? env.SMTP_USER;
    if (!recipient) return;

    try {
      const sent = await this.send({
        from: fromAddress('Lead Gen System'),
        to: recipient,
        subject: safeSubject(`New Lead: ${lead.businessName}`),
        html: buildNotificationHtml(lead),
      });
      if (!sent) return;

      await prisma.emailLog.create({
        data: { leadId: lead.id, type: 'notification', recipient, status: 'sent' },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await prisma.emailLog.create({
        data: { leadId: lead.id, type: 'notification', recipient, status: 'failed', errorMessage },
      });
      throw err;
    }
  }

  async sendLeadConfirmation(lead: LeadForEmail): Promise<void> {
    try {
      const sent = await this.send({
        from: fromAddress('Business Internet'),
        to: lead.email,
        subject: safeSubject(`We received your inquiry, ${lead.contactName.split(' ')[0] ?? 'there'}!`),
        html: buildConfirmationHtml(lead),
      });
      if (!sent) return;

      await prisma.emailLog.create({
        data: { leadId: lead.id, type: 'confirmation', recipient: lead.email, status: 'sent' },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await prisma.emailLog.create({
        data: { leadId: lead.id, type: 'confirmation', recipient: lead.email, status: 'failed', errorMessage },
      });
      throw err;
    }
  }

  async sendCustomEmail(lead: LeadForEmail, subject: string, body: string): Promise<void> {
    try {
      await this.send(
        {
          from: fromAddress('Business Internet'),
          to: lead.email,
          subject: safeSubject(subject),
          html: buildCustomHtml(lead, body),
        },
        true,
      );

      await prisma.emailLog.create({
        data: {
          leadId: lead.id,
          type: 'custom',
          subject: safeSubject(subject),
          recipient: lead.email,
          status: 'sent',
        },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await prisma.emailLog.create({
        data: {
          leadId: lead.id,
          type: 'custom',
          subject: safeSubject(subject),
          recipient: lead.email,
          status: 'failed',
          errorMessage,
        },
      });
      throw err;
    }
  }

  async sendPasswordReset(recipient: string, adminName: string, resetUrl: string): Promise<void> {
    await this.send(
      {
        from: fromAddress('Business Internet Admin'),
        to: recipient,
        subject: 'Reset your admin password',
        html: baseTemplate(`
          <h2>Password reset requested</h2>
          <p>Hi ${esc(adminName)},</p>
          <p>Use the link below to reset your admin password. This link expires soon and can only be used once.</p>
          <p><a class="button" href="${esc(resetUrl)}">Reset password</a></p>
          <p class="muted">If you did not request this, you can ignore this email.</p>
        `),
      },
      true,
    );
  }
}

export const emailService = new EmailService();

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function baseTemplate(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
  .card{background:#fff;border-radius:8px;padding:32px;max-width:560px;margin:0 auto}
  h2{color:#1a1a2e;margin-top:0}
  p{color:#374151;line-height:1.6}
  table{width:100%;border-collapse:collapse}
  td{padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
  td:first-child{color:#6b7280;width:42%}
  td:last-child{font-weight:500;color:#111827}
  .badge{display:inline-block;background:#e0f2fe;color:#0369a1;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:600;margin-bottom:24px}
  .button{display:inline-block;background:#0369a1;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700}
  .highlight{background:#f0fdf4;border-left:4px solid #22c55e;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0}
  .footer,.muted{font-size:12px;color:#9ca3af}
</style></head><body><div class="card">${content}</div></body></html>`;
}

function buildNotificationHtml(lead: LeadForEmail): string {
  const plan = lead.plan ? (PLAN_LABELS[lead.plan] ?? lead.plan) : 'Not specified';
  const employees = lead.employees ?? 'Not specified';
  return baseTemplate(`
    <h2>New Lead Submitted</h2>
    <span class="badge">Action Required</span>
    <table>
      <tr><td>Business Name</td><td>${esc(lead.businessName)}</td></tr>
      <tr><td>Business Address</td><td>${esc(lead.businessAddress)}</td></tr>
      <tr><td>Contact Name</td><td>${esc(lead.contactName)}</td></tr>
      <tr><td>Phone</td><td>${esc(lead.phone)}</td></tr>
      <tr><td>Email</td><td>${esc(lead.email)}</td></tr>
      <tr><td>Current Provider</td><td>${esc(lead.currentProvider)}</td></tr>
      <tr><td>Interested Plan</td><td>${esc(plan)}</td></tr>
      <tr><td>Employees</td><td>${esc(employees)}</td></tr>
      ${lead.comments ? `<tr><td>Comments</td><td>${esc(lead.comments)}</td></tr>` : ''}
      <tr><td>Submitted</td><td>${new Date(lead.createdAt).toLocaleString()}</td></tr>
    </table>
    <p class="footer">Lead ID: ${esc(lead.id)} - IP: ${esc(lead.ipAddress ?? 'unknown')}</p>
  `);
}

function buildConfirmationHtml(lead: LeadForEmail): string {
  const firstName = lead.contactName.split(' ')[0] ?? 'there';
  const plan = lead.plan ? (PLAN_LABELS[lead.plan] ?? lead.plan) : undefined;
  return baseTemplate(`
    <h2>Hi ${esc(firstName)}, thanks for reaching out!</h2>
    <p>We've received your inquiry for <strong>${esc(lead.businessName)}</strong> and one of our specialists will contact you within <strong>1 business day</strong>.</p>
    <div class="highlight">
      ${plan ? `<p><strong>Your selected plan:</strong> ${esc(plan)}</p>` : ''}
      <p><strong>Business:</strong> ${esc(lead.businessName)}</p>
      <p><strong>We'll reach you at:</strong> ${esc(lead.phone)} or ${esc(lead.email)}</p>
    </div>
    <p>If you have any urgent questions, feel free to reply to this email.</p>
    <p>The Business Internet Team</p>
    <div class="footer">You received this because you submitted a quote request at our website.</div>
  `);
}

function buildCustomHtml(lead: LeadForEmail, body: string): string {
  const htmlBody = body
    .split('\n')
    .map((line) => `<p>${esc(line) || '&nbsp;'}</p>`)
    .join('');

  return baseTemplate(`
    ${htmlBody}
    <div class="footer">This message was sent to ${esc(lead.email)} regarding your enquiry from ${esc(lead.businessName)}.</div>
  `);
}
