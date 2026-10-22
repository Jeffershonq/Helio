import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // `prisma generate` does not connect, so a placeholder keeps image builds working.
    url: process.env.DATABASE_URL ?? "postgresql://helio:helio@localhost:5432/helio",
  },
});
