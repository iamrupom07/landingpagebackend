import path from "path";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

export default defineConfig({
  earlyAccess: true,
  schema: path.join("prisma", "schema.prisma"),
  migrate: {
    async adapter() {
      // Prisma v7: must pass a pg.Pool instance
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
      return new PrismaPg(pool);
    },
  },
});
