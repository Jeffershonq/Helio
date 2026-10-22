import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { applyWorkspaceScope } from "@/lib/scope";

const globalForPrisma = globalThis as unknown as { __helioPrisma?: PrismaClient };

function client(): PrismaClient {
  globalForPrisma.__helioPrisma ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: env().DATABASE_URL }),
  });
  return globalForPrisma.__helioPrisma;
}

/** Unscoped client. Use only for identity data (users, sessions, tokens) and workspace creation. */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get: (_target, prop) => Reflect.get(client(), prop),
});

/** Client that is locked to one workspace. Use this for everything that belongs to a workspace. */
export function scoped(workspaceId: string) {
  return client().$extends({
    name: "workspace-scope",
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(applyWorkspaceScope(model, operation, args as any, workspaceId) as any);
        },
      },
    },
  });
}

export type ScopedDb = ReturnType<typeof scoped>;
