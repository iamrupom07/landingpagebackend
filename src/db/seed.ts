import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

// Prisma v7: PrismaPg takes a pg.Pool instance
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "Admin@123456";
  const name = process.env.ADMIN_NAME ?? "Admin";

  const existing = await (prisma as any).adminUser.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`⚠️  Admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await (prisma as any).adminUser.create({
    data: { email, passwordHash, name },
  });

  console.log(`✅ Admin created: ${email}`);
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
