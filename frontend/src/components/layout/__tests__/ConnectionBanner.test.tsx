import React from "react";
import { render, screen } from "@testing-library/react";
import { ConnectionBanner } from "../ConnectionBanner";
import { LanguageProvider } from "@/i18n";

function renderWithI18n(ui: React.ReactElement) {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

describe("ConnectionBanner", () => {
  it("renders nothing when status is connected", () => {
    const { container } = renderWithI18n(<ConnectionBanner status="connected" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when status is disconnected", () => {
    const { container } = renderWithI18n(<ConnectionBanner status="disconnected" />);
    expect(container.innerHTML).toBe("");
  });

  it("shows reconnecting message with attempt number", () => {
    renderWithI18n(<ConnectionBanner status="reconnecting" retryAttempt={3} />);
    // Default lang is zh: "连接已断开，正在重连（第 3 次）…"
    expect(screen.getByText(/重连/)).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it("defaults to attempt 1 when retryAttempt is not provided", () => {
    renderWithI18n(<ConnectionBanner status="reconnecting" />);
    // Default lang is zh: "连接已断开，正在重连（第 1 次）…"
    expect(screen.getByText(/1/)).toBeInTheDocument();
  });

  it("has warning styling", () => {
    const { container } = renderWithI18n(<ConnectionBanner status="reconnecting" retryAttempt={1} />);
    const banner = container.firstChild as HTMLElement;
    expect(banner.className).toMatch(/warning/);
  });
});
