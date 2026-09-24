import { normalizeEmail, verifyPassword } from "@shortfactory/auth";

export type AuthUser = { id: string; email: string; passwordHash: string };

export type UserLookup = { findUserByEmail(email: string): Promise<AuthUser | null> };

export async function authenticateUser(
  input: { email: string; password: string },
  lookup: UserLookup,
): Promise<Pick<AuthUser, "id" | "email"> | null> {
  const email = normalizeEmail(input.email);
  const user = await lookup.findUserByEmail(email);
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) return null;
  return { id: user.id, email: user.email };
}
