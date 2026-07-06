import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

vi.mock("@/components/background/CosmicShaderBackground", () => ({ default: () => null }));
vi.mock("echarts", () => ({ init: () => ({ setOption: () => {}, resize: () => {}, dispose: () => {} }) }));
vi.mock("@/lib/dataSource", () => ({
  fetchEnterprises: () => Promise.resolve([]),
  fetchRiskWarnings: () => Promise.resolve([]),
  getInstantEnterprises: () => [],
  getInstantRiskWarnings: () => [],
}));

import Dashboard from "@/pages/Dashboard";

describe("Dashboard page", () => {
  it("renders title", () => {
    render(<BrowserRouter><Dashboard /></BrowserRouter>);
    expect(screen.getByText("风控")).toBeTruthy();
  });

  it("renders KPI cards", () => {
    render(<BrowserRouter><Dashboard /></BrowserRouter>);
    expect(screen.getByText("监控企业")).toBeTruthy();
    expect(screen.getByText("高风险")).toBeTruthy();
  });

  it("renders quick actions", () => {
    render(<BrowserRouter><Dashboard /></BrowserRouter>);
    expect(screen.getByText("智能分析 · 一键提问")).toBeTruthy();
  });
});
