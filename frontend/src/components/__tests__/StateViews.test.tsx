import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBlock, EmptyBlock, LoadingBlock } from "@/components/StateViews";

describe("ErrorBlock", () => {
  it("renders error message", () => {
    render(<ErrorBlock message="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("renders retry button when onRetry provided", () => {
    const onRetry = vi.fn();
    render(<ErrorBlock message="Error" onRetry={onRetry} />);
    expect(screen.getByText("重试")).toBeTruthy();
  });

  it("no retry button when onRetry not provided", () => {
    render(<ErrorBlock message="Error" />);
    expect(screen.queryByText("重试")).toBeNull();
  });
});

describe("EmptyBlock", () => {
  it("renders message", () => {
    render(<EmptyBlock message="No data" />);
    expect(screen.getByText("No data")).toBeTruthy();
  });
});

describe("LoadingBlock", () => {
  it("renders loading indicator", () => {
    const { container } = render(<LoadingBlock />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });
});
