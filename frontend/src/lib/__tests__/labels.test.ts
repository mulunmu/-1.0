import { describe, it, expect } from "vitest";
import {
  DIM_KEYS,
  DIMENSION_LABELS,
  RISK_LEVEL_COLORS,
  RISK_LEVEL_FILTER_OPTIONS,
} from "@/lib/labels";

describe("labels", () => {
  it("has 5 dimension keys", () => {
    expect(DIM_KEYS.length).toBe(5);
  });

  it("every dimension has a label", () => {
    DIM_KEYS.forEach((k) => {
      expect(DIMENSION_LABELS[k]).toBeTruthy();
    });
  });

  it("every risk level has a color class", () => {
    const levels = ["低风险", "中低风险", "中等风险", "中高风险", "高风险"];
    levels.forEach((l) => {
      expect(RISK_LEVEL_COLORS[l]).toBeTruthy();
    });
  });

  it("filter options include all risk levels", () => {
    expect(RISK_LEVEL_FILTER_OPTIONS.length).toBeGreaterThanOrEqual(5);
  });
});
