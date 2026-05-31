import type { Request, Response } from 'express';
import { leadsService } from './leads.service';
import { emailService } from '../email/email.service';
import {
  createLeadSchema,
  createManualLeadSchema,
  updateLeadStatusSchema,
  sendEmailSchema,
  getLeadsQuerySchema,
} from './leads.schema';
import type { LeadApiShape } from './leads.service';

const CSV_HEADERS: (keyof LeadApiShape)[] = [
  'id', 'businessName', 'contactName', 'email', 'phone',
  'businessAddress', 'currentProvider', 'employees', 'plan',
  'status', 'source', 'ipAddress', 'createdAt',
];

function escapeCSV(value: string | undefined | null): string {
  const v = value ?? '';
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export class LeadsController {
  // ─── Public: form submission ───────────────────────────────────────────────
  async create(req: Request, res: Response) {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    }

    const ipAddress =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ||
      req.socket.remoteAddress;

    const lead = await leadsService.create(parsed.data, ipAddress);

    emailService.sendLeadNotification(lead).catch(console.error);
    emailService.sendLeadConfirmation(lead).catch(console.error);

    return res.status(201).json({
      success: true,
      message: 'Thank you! We will contact you shortly.',
      data: { id: lead.id },
    });
  }

  // ─── Admin: create lead manually ──────────────────────────────────────────
  async createManual(req: Request, res: Response) {
    const parsed = createManualLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    }

    const lead = await leadsService.createManual(parsed.data);
    return res.status(201).json({ success: true, data: lead });
  }

  // ─── Admin: send custom email to a lead ───────────────────────────────────
  async sendEmail(req: Request, res: Response) {
    const lead = await leadsService.findById(req.params['id']!);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const parsed = sendEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    }

    await emailService.sendCustomEmail(lead, parsed.data.subject, parsed.data.body);
    return res.json({ success: true, message: 'Email sent successfully' });
  }

  // ─── Admin: list all leads ─────────────────────────────────────────────────
  async findAll(req: Request, res: Response) {
    const parsed = getLeadsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    }
    const result = await leadsService.findAll(parsed.data);
    return res.json({ success: true, ...result });
  }

  async exportCSV(req: Request, res: Response) {
    const q      = req.query as Record<string, string | undefined>;
    const status = q['status'] as Parameters<typeof leadsService.findAllForExport>[0]['status'];
    const plan   = q['plan']   as Parameters<typeof leadsService.findAllForExport>[0]['plan'];
    const source = q['source'] as Parameters<typeof leadsService.findAllForExport>[0]['source'];
    const search = q['search'];

    const leads    = await leadsService.findAllForExport({ status, plan, search, source });
    const rows     = leads.map((l) => CSV_HEADERS.map((h) => escapeCSV(l[h] as string | undefined)).join(','));
    const csv      = [CSV_HEADERS.join(','), ...rows].join('\n');
    const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  }

  async findById(req: Request, res: Response) {
    const lead = await leadsService.findById(req.params['id']!);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    return res.json({ success: true, data: lead });
  }

  async updateStatus(req: Request, res: Response) {
    const parsed = updateLeadStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    }
    const lead = await leadsService.updateStatus(req.params['id']!, parsed.data);
    return res.json({ success: true, data: lead });
  }

  async delete(req: Request, res: Response) {
    await leadsService.delete(req.params['id']!);
    return res.json({ success: true, message: 'Lead deleted' });
  }
}

export const leadsController = new LeadsController();
