import { describe, expect, it } from "vitest";
import { createSessionToken, hashPassword, sessionCookie, verifyPassword, verifySessionToken } from "../src/index";

describe("password auth", () => {
  it("hashes and verifies without storing the plaintext", async () => {
    const encoded = await hashPassword("correct horse battery staple");
    expect(encoded).not.toContain("correct horse");
    await expect(verifyPassword("correct horse battery staple", encoded)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", encoded)).resolves.toBe(false);
  });

  it("rejects short passwords and malformed hashes", async () => {
    await expect(hashPassword("too-short")).rejects.toThrow();
    await expect(verifyPassword("anything", "invalid")).resolves.toBe(false);
  });
});

describe("signed sessions", () => {
  it("round-trips and expires a signed token", () => {
    const token = createSessionToken("user-1", "test-secret", 1_700_000_000_000, 60);
    expect(verifySessionToken(token, "test-secret", 1_700_000_030_000)?.subject).toBe("user-1");
    expect(verifySessionToken(token, "test-secret", 1_700_000_061_000)).toBeNull();
    expect(verifySessionToken(token, "wrong-secret", 1_700_000_030_000)).toBeNull();
  });

  it("emits a protected cookie", () => {
    const cookie = sessionCookie("token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
  });
});
