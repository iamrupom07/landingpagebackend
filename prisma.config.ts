import path from "path";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  earlyAccess: true,
  schema: path.join("prisma", "schema.prisma"),
  migrate: {
    // FIX: `prisma migrate deploy` and `prisma db push` require a url in the
    // config for CLI use. The adapter() alone is not enough for those commands.
    url: process.env.DATABASE_URL!,
    async adapter() {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
      return new PrismaPg(pool);
    },
  },
});
