import type { Request, Response } from 'express';
import { leadsService } from '../leads/leads.service';

export class AnalyticsController {
  async getSummary(_req: Request, res: Response) {
    const summary = await leadsService.getSummary();
    return res.json({ success: true, data: summary });
  }
}

export const analyticsController = new AnalyticsController();
