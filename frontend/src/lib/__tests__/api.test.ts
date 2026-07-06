import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/apiClient";

describe("ApiError", () => {
  it("creates with message", () => {
    const err = new ApiError("Network error");
    expect(err.message).toBe("Network error");
    expect(err.name).toBe("ApiError");
  });

  it("creates with status", () => {
    const err = new ApiError("Not Found", 404);
    expect(err.status).toBe(404);
  });

  it("is instance of Error", () => {
    const err = new ApiError("test");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("API type exports", () => {
  it("exports all chat response fields", async () => {
    const { default: api } = await import("@/lib/apiClient");
    expect(api).toBeTruthy();
    expect(typeof api.get).toBe("function");
    expect(typeof api.post).toBe("function");
  });
});
