import { describe, it, expect } from "vitest";
import {
  getDataModeSync,
  shouldUseRealApi,
  getInstantEnterprises,
  getInstantRiskWarnings,
  type DataMode,
} from "@/lib/dataSource";

describe("dataSource", () => {
  it("getDataModeSync returns a valid mode", () => {
    const mode = getDataModeSync();
    expect(["mock", "mock_with_llm", "live"]).toContain(mode);
  });

  it("shouldUseRealApi returns boolean", () => {
    expect(typeof shouldUseRealApi()).toBe("boolean");
  });

  it("shouldUseRealApi is false for mock mode", () => {
    const mode = getDataModeSync();
    if (mode === "mock") {
      expect(shouldUseRealApi()).toBe(false);
    }
  });

  it("shouldUseRealApi is true for mock_with_llm", () => {
    const mode = getDataModeSync();
    if (mode === "mock_with_llm") {
      expect(shouldUseRealApi()).toBe(true);
    }
  });

  it("getInstantEnterprises returns 200 items", () => {
    const ents = getInstantEnterprises();
    expect(ents.length).toBe(200);
    expect(ents[0].enterprise_id).toBe("ENT001");
  });

  it("getInstantRiskWarnings returns filtered items", () => {
    const warnings = getInstantRiskWarnings();
    expect(warnings.length).toBeGreaterThan(0);
    warnings.forEach((w) => {
      expect(w.enterprise_id).toBeTruthy();
      expect(w.enterprise_name).toBeTruthy();
    });
  });
});
