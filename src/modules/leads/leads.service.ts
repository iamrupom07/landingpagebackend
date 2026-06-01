import type { Lead, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { cacheService } from "../../services/cache.service";
import { env } from "../../config/env";
import type {
  CreateLeadInput,
  CreateManualLeadInput,
  ExportLeadsQuery,
  GetLeadsQuery,
  UpdateLeadStatusInput,
} from "./leads.schema";
import {
  PLAN_MAP,
  PLAN_MAP_REVERSE,
  STATUS_MAP,
  STATUS_MAP_REVERSE,
} from "./leads.schema";

const SUMMARY_CACHE_KEY = "analytics:summary";
const SUMMARY_CACHE_TTL_SECONDS = 60;
const EXPORT_BATCH_SIZE = 500;
let summaryLoadPromise: Promise<LeadSummary> | null = null;

export interface LeadApiShape {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  businessAddress: string;
  currentProvider: string;
  employees?: string;
  comments?: string;
  status: string;
  plan?: string;
  source: string;
  ipAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadSummary {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  closed_won: number;
  closed_lost: number;
  byPlan: {
    starter: number;
    professional: number;
    enterprise: number;
  };
  recentCount: number;
  formCount: number;
  manualCount: number;
  conversionRate: number;
}

type ExportCursor = {
  createdAt: Date;
  id: string;
};

type SummaryRow = {
  total: number | bigint | string;
  new_count: number | bigint | string;
  contacted_count: number | bigint | string;
  qualified_count: number | bigint | string;
  closed_won_count: number | bigint | string;
  closed_lost_count: number | bigint | string;
  starter_count: number | bigint | string;
  professional_count: number | bigint | string;
  enterprise_count: number | bigint | string;
  recent_count: number | bigint | string;
  form_count: number | bigint | string;
  manual_count: number | bigint | string;
};

function transformLead(lead: Lead): LeadApiShape {
  return {
    id: lead.id,
    businessName: lead.businessName,
    contactName: lead.contactName,
    phone: lead.phone,
    email: lead.email,
    businessAddress: lead.businessAddress,
    currentProvider: lead.currentProvider,
    employees:
      lead.employeeCount != null ? String(lead.employeeCount) : undefined,
    comments: lead.comments ?? undefined,
    status: STATUS_MAP_REVERSE[lead.status] ?? lead.status.toLowerCase(),
    plan: lead.interestedPlan
      ? (PLAN_MAP_REVERSE[lead.interestedPlan] ??
        lead.interestedPlan.toLowerCase())
      : undefined,
    source: lead.source ?? "form",
    ipAddress: lead.ipAddress ?? undefined,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

function toNumber(value: number | bigint | string): number {
  return typeof value === "number" ? value : Number(value);
}

function buildLeadWhere(
  query: Pick<GetLeadsQuery, "status" | "plan" | "search" | "source"> | ExportLeadsQuery,
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  if (query.status) where.status = STATUS_MAP[query.status];
  if (query.plan) where.interestedPlan = PLAN_MAP[query.plan];
  if (query.source) where.source = query.source;

  const search = query.search?.trim();
  if (search) {
    where.OR = [
      { businessName: { contains: search, mode: "insensitive" } },
      { contactName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

function addExportCursor(
  where: Prisma.LeadWhereInput,
  cursor?: ExportCursor,
): Prisma.LeadWhereInput {
  if (!cursor) return where;

  return {
    AND: [
      where,
      {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      },
    ],
  };
}

async function invalidateSummaryCache(): Promise<void> {
  await cacheService.delete(SUMMARY_CACHE_KEY).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to invalidate summary cache:", message);
  });
}

export class LeadsService {
  async create(
    data: CreateLeadInput,
    ipAddress?: string,
  ): Promise<LeadApiShape> {
    const employeeCount =
      data.employeeCount ??
      (data.employees ? parseInt(data.employees, 10) || undefined : undefined);

    const interestedPlan = data.interestedPlan
      ? PLAN_MAP[data.interestedPlan]
      : undefined;

    const lead = await prisma.lead.create({
      data: {
        businessName: data.businessName,
        businessAddress: data.businessAddress,
        contactName: data.contactName,
        phone: data.phone,
        email: data.email,
        currentProvider: data.currentProvider,
        source: "form",
        ...(interestedPlan ? { interestedPlan } : {}),
        ...(employeeCount ? { employeeCount } : {}),
        ...(data.comments ? { comments: data.comments } : {}),
        ipAddress: ipAddress ?? null,
      },
    });

    await invalidateSummaryCache();
    return transformLead(lead);
  }

  async createManual(data: CreateManualLeadInput): Promise<LeadApiShape> {
    const interestedPlan = data.interestedPlan
      ? PLAN_MAP[data.interestedPlan]
      : undefined;
    const statusDb = STATUS_MAP[data.status ?? "new"];

    const lead = await prisma.lead.create({
      data: {
        businessName: data.businessName,
        businessAddress: data.businessAddress,
        contactName: data.contactName,
        phone: data.phone,
        email: data.email,
        currentProvider: data.currentProvider,
        source: "manual",
        status: statusDb,
        ...(interestedPlan ? { interestedPlan } : {}),
        ...(data.employeeCount ? { employeeCount: data.employeeCount } : {}),
        ...(data.comments ? { comments: data.comments } : {}),
      },
    });

    await invalidateSummaryCache();
    return transformLead(lead);
  }

  async findAll(query: GetLeadsQuery) {
    const pageSize = query.pageSize ?? query.limit ?? 20;
    const page = Math.max(1, query.page);
    const skip = (page - 1) * pageSize;
    const where = buildLeadWhere(query);

    const [rows, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: pageSize,
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      leads: rows.map(transformLead),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(id: string) {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { emailLogs: { orderBy: { sentAt: "desc" } } },
    });

    if (!lead) return null;
    return { ...transformLead(lead), emailLogs: lead.emailLogs };
  }

  async updateStatus(
    id: string,
    data: UpdateLeadStatusInput,
  ): Promise<LeadApiShape> {
    const lead = await prisma.lead.update({
      where: { id },
      data: { status: STATUS_MAP[data.status] },
    });
    await invalidateSummaryCache();
    return transformLead(lead);
  }

  async delete(id: string): Promise<void> {
    await prisma.lead.delete({ where: { id } });
    await invalidateSummaryCache();
  }

  async countForExport(query: ExportLeadsQuery): Promise<number> {
    return prisma.lead.count({ where: buildLeadWhere(query) });
  }

  async *iterateForExport(
    query: ExportLeadsQuery,
    maxRows = env.MAX_EXPORT_ROWS,
    batchSize = EXPORT_BATCH_SIZE,
  ): AsyncGenerator<LeadApiShape[]> {
    const baseWhere = buildLeadWhere(query);
    let cursor: ExportCursor | undefined;
    let remaining = maxRows;

    while (remaining > 0) {
      const take = Math.min(batchSize, remaining);
      const rows = await prisma.lead.findMany({
        where: addExportCursor(baseWhere, cursor),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
      });

      if (rows.length === 0) return;

      yield rows.map(transformLead);
      remaining -= rows.length;

      const last = rows[rows.length - 1]!;
      cursor = { createdAt: last.createdAt, id: last.id };

      if (rows.length < take) return;
    }
  }

  async findAllForExport(query: ExportLeadsQuery): Promise<LeadApiShape[]> {
    const leads: LeadApiShape[] = [];
    for await (const batch of this.iterateForExport(query)) {
      leads.push(...batch);
    }
    return leads;
  }

  async getSummary(): Promise<LeadSummary> {
    const cached = await cacheService.getJson<LeadSummary>(SUMMARY_CACHE_KEY);
    if (cached) return cached;

    summaryLoadPromise ??= this.loadSummary().finally(() => {
      summaryLoadPromise = null;
    });

    return summaryLoadPromise;
  }

  private async loadSummary(): Promise<LeadSummary> {
    const rows = await prisma.$queryRaw<SummaryRow[]>`
      SELECT
        (COUNT(*))::int AS total,
        (COUNT(*) FILTER (WHERE "status" = 'NEW'))::int AS new_count,
        (COUNT(*) FILTER (WHERE "status" = 'CONTACTED'))::int AS contacted_count,
        (COUNT(*) FILTER (WHERE "status" = 'QUALIFIED'))::int AS qualified_count,
        (COUNT(*) FILTER (WHERE "status" = 'CLOSED_WON'))::int AS closed_won_count,
        (COUNT(*) FILTER (WHERE "status" = 'CLOSED_LOST'))::int AS closed_lost_count,
        (COUNT(*) FILTER (WHERE "interested_plan" = 'STARTER'))::int AS starter_count,
        (COUNT(*) FILTER (WHERE "interested_plan" = 'PROFESSIONAL'))::int AS professional_count,
        (COUNT(*) FILTER (WHERE "interested_plan" = 'ENTERPRISE'))::int AS enterprise_count,
        (COUNT(*) FILTER (WHERE "created_at" >= NOW() - INTERVAL '7 days'))::int AS recent_count,
        (COUNT(*) FILTER (WHERE "source" = 'form'))::int AS form_count,
        (COUNT(*) FILTER (WHERE "source" = 'manual'))::int AS manual_count
      FROM "leads";
    `;

    const row = rows[0];
    const total = row ? toNumber(row.total) : 0;
    const closedWon = row ? toNumber(row.closed_won_count) : 0;

    const summary: LeadSummary = {
      total,
      new: row ? toNumber(row.new_count) : 0,
      contacted: row ? toNumber(row.contacted_count) : 0,
      qualified: row ? toNumber(row.qualified_count) : 0,
      closed_won: closedWon,
      closed_lost: row ? toNumber(row.closed_lost_count) : 0,
      byPlan: {
        starter: row ? toNumber(row.starter_count) : 0,
        professional: row ? toNumber(row.professional_count) : 0,
        enterprise: row ? toNumber(row.enterprise_count) : 0,
      },
      recentCount: row ? toNumber(row.recent_count) : 0,
      formCount: row ? toNumber(row.form_count) : 0,
      manualCount: row ? toNumber(row.manual_count) : 0,
      conversionRate: total > 0 ? Math.round((closedWon / total) * 100) : 0,
    };

    await cacheService
      .setJson(SUMMARY_CACHE_KEY, summary, SUMMARY_CACHE_TTL_SECONDS)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Failed to cache summary:", message);
      });

    return summary;
  }
}

export const leadsService = new LeadsService();
