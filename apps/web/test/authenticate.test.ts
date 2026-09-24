import { describe, expect, it } from "vitest";
import { hashPassword } from "@shortfactory/auth";
import { authenticateUser } from "../src/authenticate";

describe("authenticateUser", () => {
  it("normalizes email and verifies the stored password hash", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");
    const lookup = { findUserByEmail: async (email: string) => ({ id: "user-1", email, passwordHash }) };

    await expect(authenticateUser({ email: " ADMIN@EXAMPLE.COM ", password: "correct horse battery staple" }, lookup))
      .resolves.toEqual({ id: "user-1", email: "admin@example.com" });
  });

  it("rejects an unknown user or wrong password", async () => {
    const lookup = { findUserByEmail: async () => null };
    await expect(authenticateUser({ email: "admin@example.com", password: "wrong" }, lookup)).resolves.toBeNull();
  });
});
