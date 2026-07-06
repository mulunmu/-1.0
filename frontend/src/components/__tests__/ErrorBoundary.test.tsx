import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "@/components/ErrorBoundary";

function ThrowError({ msg }: { msg: string }): JSX.Element {
  throw new Error(msg);
}

// Suppress console.error during error boundary tests
const originalError = console.error;
beforeAll(() => { console.error = vi.fn(); });
afterAll(() => { console.error = originalError; });

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("renders fallback when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowError msg="test error" />
      </ErrorBoundary>
    );
    expect(screen.getByText("页面出现异常")).toBeTruthy();
    expect(screen.getByText("test error")).toBeTruthy();
  });
});
