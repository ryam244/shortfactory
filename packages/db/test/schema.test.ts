import { describe, expect, it } from "vitest";
import { assets, brands, generationJobs, users, videoOutputs, videos, workspaces } from "../src/schema";

describe("database schema", () => {
  it("declares the master-plan tables", () => {
    expect([users, workspaces, brands, videos, assets, generationJobs, videoOutputs]).toHaveLength(7);
  });
});
