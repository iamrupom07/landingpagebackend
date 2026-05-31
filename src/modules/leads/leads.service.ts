import { prisma } from "../../db/prisma";
import type {
  CreateLeadInput,
  CreateManualLeadInput,
  GetLeadsQuery,
  UpdateLeadStatusInput,
} from "./leads.schema";
import {
  PLAN_MAP,
  PLAN_MAP_REVERSE,
  STATUS_MAP,
  STATUS_MAP_REVERSE,
} from "./leads.schema";

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

interface DbLead {
  id: string;
  businessName: string;
  businessAddress: string;
  contactName: string;
  phone: string;
  email: string;
  currentProvider: string;
  interestedPlan: string | null;
  employeeCount: number | null;
  comments: string | null;
  status: string;
  source: string;
  ipAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function transformLead(lead: DbLead): LeadApiShape {
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

export class LeadsService {
  // ─── Public form submission ────────────────────────────────────────────────
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

    const lead = (await (prisma as any).lead.create({
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
    })) as DbLead;

    return transformLead(lead);
  }

  // ─── Admin manual lead creation ────────────────────────────────────────────
  async createManual(data: CreateManualLeadInput): Promise<LeadApiShape> {
    const interestedPlan = data.interestedPlan
      ? PLAN_MAP[data.interestedPlan]
      : undefined;
    const statusDb = STATUS_MAP[data.status ?? "new"] ?? "NEW";

    const lead = (await (prisma as any).lead.create({
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
    })) as DbLead;

    return transformLead(lead);
  }

  // ─── List with filters ─────────────────────────────────────────────────────
  async findAll(query: GetLeadsQuery) {
    const pageSize = query.pageSize ?? query.limit ?? 20;
    const page = Math.max(1, query.page);
    const { status, plan, search, source } = query;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (status) where["status"] = STATUS_MAP[status];
    if (plan) where["interestedPlan"] = PLAN_MAP[plan];
    if (source) where["source"] = source;
    if (search) {
      where["OR"] = [
        { businessName: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    // $transaction([]) is NOT supported with driver adapters in Prisma v7.
    // Use Promise.all() instead for parallel queries.
    const [rows, total] = (await Promise.all([
      (prisma as any).lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      (prisma as any).lead.count({ where }),
    ])) as [DbLead[], number];

    return {
      leads: rows.map(transformLead),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(id: string) {
    const lead = (await (prisma as any).lead.findUnique({
      where: { id },
      include: { emailLogs: { orderBy: { sentAt: "desc" } } },
    })) as (DbLead & { emailLogs: unknown[] }) | null;

    if (!lead) return null;
    return { ...transformLead(lead), emailLogs: lead.emailLogs };
  }

  async updateStatus(
    id: string,
    data: UpdateLeadStatusInput,
  ): Promise<LeadApiShape> {
    const lead = (await (prisma as any).lead.update({
      where: { id },
      data: { status: STATUS_MAP[data.status] },
    })) as DbLead;
    return transformLead(lead);
  }

  async delete(id: string): Promise<void> {
    await (prisma as any).lead.delete({ where: { id } });
  }

  async findAllForExport(
    query: Pick<GetLeadsQuery, "status" | "plan" | "search" | "source">,
  ): Promise<LeadApiShape[]> {
    const where: Record<string, unknown> = {};
    if (query.status) where["status"] = STATUS_MAP[query.status];
    if (query.plan) where["interestedPlan"] = PLAN_MAP[query.plan];
    if (query.source) where["source"] = query.source;
    if (query.search) {
      where["OR"] = [
        { businessName: { contains: query.search, mode: "insensitive" } },
        { contactName: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }
    const rows = (await (prisma as any).lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })) as DbLead[];
    return rows.map(transformLead);
  }

  async getSummary() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

    // $transaction([]) is NOT supported with driver adapters in Prisma v7.
    // Use Promise.all() for parallel queries.
    const [total, byStatus, byPlan, recentCount] = (await Promise.all([
      (prisma as any).lead.count(),
      (prisma as any).lead.groupBy({ by: ["status"], _count: { _all: true } }),
      (prisma as any).lead.groupBy({
        by: ["interestedPlan"],
        _count: { _all: true },
      }),
      (prisma as any).lead.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
    ])) as [
      number,
      Array<{ status: string; _count: { _all: number } }>,
      Array<{ interestedPlan: string | null; _count: { _all: number } }>,
      number,
    ];

    // Source counts in a separate try/catch — gracefully returns 0 if
    // the migration hasn't been run yet and the source column is missing.
    let formCount = 0;
    let manualCount = 0;
    try {
      [formCount, manualCount] = (await Promise.all([
        (prisma as any).lead.count({ where: { source: "form" } }),
        (prisma as any).lead.count({ where: { source: "manual" } }),
      ])) as [number, number];
    } catch {
      // source column not yet migrated — safe to ignore
    }

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) {
      statusCounts[STATUS_MAP_REVERSE[row.status] ?? row.status.toLowerCase()] =
        row._count._all;
    }

    const planCounts: Record<string, number> = {
      starter: 0,
      professional: 0,
      enterprise: 0,
    };
    for (const row of byPlan) {
      if (row.interestedPlan) {
        planCounts[
          PLAN_MAP_REVERSE[row.interestedPlan] ??
            row.interestedPlan.toLowerCase()
        ] = row._count._all;
      }
    }

    const closedWon = statusCounts["closed_won"] ?? 0;

    return {
      total,
      new: statusCounts["new"] ?? 0,
      contacted: statusCounts["contacted"] ?? 0,
      qualified: statusCounts["qualified"] ?? 0,
      closed_won: closedWon,
      closed_lost: statusCounts["closed_lost"] ?? 0,
      byPlan: {
        starter: planCounts["starter"] ?? 0,
        professional: planCounts["professional"] ?? 0,
        enterprise: planCounts["enterprise"] ?? 0,
      },
      recentCount,
      formCount,
      manualCount,
      conversionRate: total > 0 ? Math.round((closedWon / total) * 100) : 0,
    };
  }
}

export const leadsService = new LeadsService();
