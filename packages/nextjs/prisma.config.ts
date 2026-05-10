import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
    // Necesario para `prisma migrate dev/diff`. Sin esto, los comandos que
    // usan shadow DB fallan. Define SHADOW_DATABASE_URL en tu .env apuntando
    // a una DB separada (ej. la misma instancia Postgres con otra base).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
