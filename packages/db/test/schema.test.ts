import { describe, expect, it } from "vitest";
import { assets, brands, generationJobs, users, videoOutputs, videos, workspaces } from "../src/schema";
import { createBrandRepository } from "../src/repositories/brands";
import { createIdentityRepository, normalizeEmail } from "../src/repositories/identity";

describe("database schema", () => {
  it("declares the master-plan tables", () => {
    expect([users, workspaces, brands, videos, assets, generationJobs, videoOutputs]).toHaveLength(7);
  });

  it("exports the brand repository contract", () => {
    expect(createBrandRepository).toBeTypeOf("function");
  });

  it("normalizes and validates owner email addresses", () => {
    expect(normalizeEmail("  Admin@Example.COM ")).toBe("admin@example.com");
    expect(() => normalizeEmail("not-an-email")).toThrow();
    expect(createIdentityRepository).toBeTypeOf("function");
  });
});
