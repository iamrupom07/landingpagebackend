import { z } from 'zod';

export const PLAN_MAP = {
  starter:      'STARTER',
  professional: 'PROFESSIONAL',
  enterprise:   'ENTERPRISE',
} as const;

export const PLAN_MAP_REVERSE = {
  STARTER:      'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE:   'enterprise',
} as const;

export const PLAN_LABELS: Record<string, string> = {
  starter:      '300 Mbps — $59.99/month',
  professional: '1 Gig — $99.99/month',
  enterprise:   '2 Gig — $134.99/month',
};

export const STATUS_MAP = {
  new:         'NEW',
  contacted:   'CONTACTED',
  qualified:   'QUALIFIED',
  closed_won:  'CLOSED_WON',
  closed_lost: 'CLOSED_LOST',
} as const;

export const STATUS_MAP_REVERSE = {
  NEW:         'new',
  CONTACTED:   'contacted',
  QUALIFIED:   'qualified',
  CLOSED_WON:  'closed_won',
  CLOSED_LOST: 'closed_lost',
} as const;

// ─── Schemas ──────────────────────────────────────────────────────────────────

// Used by the public landing-page form
export const createLeadSchema = z.object({
  businessName:    z.string().min(2).max(255),
  businessAddress: z.string().min(5).max(500),
  contactName:     z.string().min(2).max(255),
  phone:           z.string().regex(/^\+?[\d\s\-().]{7,20}$/, 'Please enter a valid phone number'),
  email:           z.string().email(),
  currentProvider: z.string().min(1).max(255),
  interestedPlan:  z.enum(['starter', 'professional', 'enterprise']).optional(),
  employees:       z.string().optional(),
  employeeCount:   z.coerce.number().int().positive().max(100_000).optional(),
  comments:        z.string().max(1000).optional(),
});

// Used by the admin to create a lead manually
export const createManualLeadSchema = z.object({
  businessName:    z.string().min(2).max(255),
  businessAddress: z.string().min(5).max(500),
  contactName:     z.string().min(2).max(255),
  phone:           z.string().regex(/^\+?[\d\s\-().]{7,20}$/, 'Please enter a valid phone number'),
  email:           z.string().email(),
  currentProvider: z.string().min(1).max(255),
  interestedPlan:  z.enum(['starter', 'professional', 'enterprise']).optional(),
  employeeCount:   z.coerce.number().int().positive().max(100_000).optional(),
  comments:        z.string().max(1000).optional(),
  status:          z.enum(['new', 'contacted', 'qualified', 'closed_won', 'closed_lost']).default('new'),
});

export const updateLeadStatusSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'closed_won', 'closed_lost']),
});

export const sendEmailSchema = z.object({
  subject: z.string().min(1).max(255),
  body:    z.string().min(1).max(10_000),
});

export const getLeadsQuerySchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit:    z.coerce.number().int().min(1).max(100).optional(),
  status:   z.enum(['new', 'contacted', 'qualified', 'closed_won', 'closed_lost']).optional(),
  plan:     z.enum(['starter', 'professional', 'enterprise']).optional(),
  search:   z.string().max(100).optional(),
  source:   z.enum(['form', 'manual']).optional(),
});

export const exportLeadsQuerySchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'closed_won', 'closed_lost']).optional(),
  plan:   z.enum(['starter', 'professional', 'enterprise']).optional(),
  search: z.string().max(100).optional(),
  source: z.enum(['form', 'manual']).optional(),
});

export type CreateLeadInput       = z.infer<typeof createLeadSchema>;
export type CreateManualLeadInput = z.infer<typeof createManualLeadSchema>;
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;
export type SendEmailInput        = z.infer<typeof sendEmailSchema>;
export type GetLeadsQuery         = z.infer<typeof getLeadsQuerySchema>;
export type ExportLeadsQuery      = z.infer<typeof exportLeadsQuerySchema>;
