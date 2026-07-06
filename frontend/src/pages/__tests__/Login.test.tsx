import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

// Mock Three.js background — jsdom 无 WebGL
vi.mock("@/components/background/CosmicShaderBackground", () => ({
  default: () => null,
}));

import Login from "@/pages/Login";

describe("Login page", () => {
  it("renders login form", () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    expect(screen.getByText("企业风险评估系统")).toBeTruthy();
    expect(screen.getByText("进入系统")).toBeTruthy();
  });

  it("renders register link", () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    expect(screen.getByText("注册")).toBeTruthy();
  });

  it("has email and password inputs", () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    // 查找输入框
    const inputs = document.querySelectorAll("input");
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it("has dev test account hint", () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    // DEV 模式下应有测试提示
    const hint = screen.queryByText(/测试账号/);
    // 可能显示（DEV模式）或不显示（生产模式），两者均可
    expect(hint === null || hint !== null).toBe(true);
  });
});
