import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { ToolProgressIndicator } from "../ToolProgressIndicator";
import type { ToolCallEntry } from "@/types/agent";

function makeTc(overrides: Partial<ToolCallEntry> = {}): ToolCallEntry {
  return {
    id: "tc-1",
    tool: "run_backtest",
    arguments: {},
    status: "running",
    timestamp: Date.now(),
    ...overrides,
  };
}

function renderWithI18n(ui: React.ReactElement) {
  localStorage.setItem("vibe-lang", "en");
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

describe("ToolProgressIndicator", () => {
  it("renders nothing when no tools are running", () => {
    const tcs = [makeTc({ status: "ok" }), makeTc({ id: "tc-2", status: "error" })];
    const { container } = renderWithI18n(<ToolProgressIndicator toolCalls={tcs} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for empty array", () => {
    const { container } = renderWithI18n(<ToolProgressIndicator toolCalls={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders single running tool", () => {
    const tcs = [makeTc({ elapsed_s: 5 })];
    renderWithI18n(<ToolProgressIndicator toolCalls={tcs} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Run backtest/)).toBeInTheDocument();
    expect(screen.getByText("5s")).toBeInTheDocument();
  });

  it("renders multiple running tools with header", () => {
    const tcs = [
      makeTc({ id: "tc-1", tool: "bash" }),
      makeTc({ id: "tc-2", tool: "write_file" }),
    ];
    renderWithI18n(<ToolProgressIndicator toolCalls={tcs} />);
    expect(screen.getByText("2 tools running")).toBeInTheDocument();
    expect(screen.getByText(/Run command/)).toBeInTheDocument();
    expect(screen.getByText(/Generate code/)).toBeInTheDocument();
  });

  it("shows overflow indicator for > 3 running tools", () => {
    const tcs = [
      makeTc({ id: "tc-1", tool: "bash" }),
      makeTc({ id: "tc-2", tool: "write_file" }),
      makeTc({ id: "tc-3", tool: "run_backtest" }),
      makeTc({ id: "tc-4", tool: "read_file" }),
    ];
    renderWithI18n(<ToolProgressIndicator toolCalls={tcs} />);
    expect(screen.getByText(/2 more/)).toBeInTheDocument();
  });

  it("shows determinate progress bar when progress data exists", () => {
    const tcs = [
      makeTc({
        progress: { current: 5, total: 10, stage: "Processing" },
      }),
    ];
    renderWithI18n(<ToolProgressIndicator toolCalls={tcs} />);
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("5/10")).toBeInTheDocument();
    // Should have a progressbar element
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
