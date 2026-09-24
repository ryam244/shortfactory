import { asc, eq } from "drizzle-orm";
import type { ShortFactoryDb } from "../client";
import { users, workspaces } from "../schema";

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) throw new Error("有効なメールアドレスが必要です");
  return normalized;
}

export function createIdentityRepository(db: ShortFactoryDb) {
  return {
    async createUser(input: { email: string; passwordHash: string }) {
      if (!input.passwordHash.trim()) throw new Error("passwordHashは必須です");
      const [user] = await db.insert(users).values({
        email: normalizeEmail(input.email),
        passwordHash: input.passwordHash,
      }).returning({ id: users.id, email: users.email, createdAt: users.createdAt });
      return user!;
    },

    async findUserByEmail(email: string) {
      const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
      return user ?? null;
    },

    async createWorkspace(input: { ownerUserId: string; name: string }) {
      const name = input.name.trim();
      if (!name) throw new Error("workspace nameは必須です");
      const [workspace] = await db.insert(workspaces).values({ ownerUserId: input.ownerUserId, name }).returning();
      return workspace!;
    },

    async listWorkspaces(ownerUserId: string) {
      return db.select().from(workspaces).where(eq(workspaces.ownerUserId, ownerUserId)).orderBy(asc(workspaces.createdAt));
    },
  };
}
