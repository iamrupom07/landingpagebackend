import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { leadsService } from './leads.service';
import { enqueueEmailJob } from '../email/email.queue';
import {
  createLeadSchema,
  createManualLeadSchema,
  exportLeadsQuerySchema,
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
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function writeChunk(res: Response, chunk: string): Promise<void> {
  if (res.write(chunk)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    res.once('drain', resolve);
    res.once('error', reject);
  });
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

    void Promise.all([
      enqueueEmailJob({ type: 'lead-notification', lead }),
      enqueueEmailJob({ type: 'lead-confirmation', lead }),
    ]).catch((err) => console.error('Failed to queue lead email jobs:', err));

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

    await enqueueEmailJob({
      type: 'custom-email',
      lead,
      subject: parsed.data.subject,
      body: parsed.data.body,
    });
    return res.json({ success: true, message: 'Email queued successfully' });
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
    const parsed = exportLeadsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    }

    const total = await leadsService.countForExport(parsed.data);
    const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (total > env.MAX_EXPORT_ROWS) {
      res.setHeader('X-Export-Truncated', 'true');
    }

    await writeChunk(res, `${CSV_HEADERS.join(',')}\n`);
    for await (const batch of leadsService.iterateForExport(parsed.data, env.MAX_EXPORT_ROWS)) {
      for (const lead of batch) {
        const row = CSV_HEADERS.map((h) => escapeCSV(lead[h] as string | undefined)).join(',');
        await writeChunk(res, `${row}\n`);
      }
    }

    return res.end();
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
