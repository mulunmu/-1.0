import { describe, it, expect } from "vitest";
import {
  ENTERPRISE_IDS,
  SEED_ENTERPRISE_A,
  SEED_ENTERPRISE_B,
  QUICK_COMPARE_QUERY,
  QUICK_ANALYZE_QUERY,
} from "@/lib/constants";

describe("constants", () => {
  it("has 10 seed enterprise IDs", () => {
    expect(ENTERPRISE_IDS.length).toBe(10);
  });

  it("seed names are non-empty", () => {
    expect(SEED_ENTERPRISE_A.length).toBeGreaterThan(0);
    expect(SEED_ENTERPRISE_B.length).toBeGreaterThan(0);
  });

  it("quick queries contain seed enterprise names", () => {
    expect(QUICK_COMPARE_QUERY).toContain(SEED_ENTERPRISE_A);
    expect(QUICK_ANALYZE_QUERY).toContain(SEED_ENTERPRISE_A);
  });
});
