import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { env } from "../config/env";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

let pool: pg.Pool | undefined;

function createClient(): PrismaClient {
  // Prisma v7: PrismaPg takes a pg.Pool instance, NOT a {connectionString} object
  pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = global.__prisma ?? createClient();

if (env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export async function closePrisma(): Promise<void> {
  await prisma.$disconnect().catch(() => undefined);
  if (pool) {
    await pool.end().catch(() => undefined);
    pool = undefined;
  }
}
