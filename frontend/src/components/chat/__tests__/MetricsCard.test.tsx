import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { MetricsCard } from "../MetricsCard";

/** Render with i18n forced to English (tests assert against en dict). */
function renderWithI18n(ui: React.ReactElement) {
  localStorage.setItem("vibe-lang", "en");
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

describe("MetricsCard", () => {
  const sampleMetrics = {
    total_return: 0.1234,
    annual_return: 0.08,
    sharpe: 1.5,
    max_drawdown: -0.1,
    win_rate: 0.55,
    trade_count: 42,
  };

  it("renders nothing when metrics is empty", () => {
    const { container } = renderWithI18n(<MetricsCard metrics={{}} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders metric labels", () => {
    renderWithI18n(<MetricsCard metrics={sampleMetrics} />);
    expect(screen.getByText("Total Return")).toBeInTheDocument();
    expect(screen.getByText("Sharpe")).toBeInTheDocument();
    expect(screen.getByText("Max DD")).toBeInTheDocument();
    expect(screen.getByText("Trades")).toBeInTheDocument();
  });

  it("renders formatted metric values", () => {
    renderWithI18n(<MetricsCard metrics={sampleMetrics} />);
    expect(screen.getByText("+12.34%")).toBeInTheDocument();
    expect(screen.getByText("+1.50")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("compact mode shows only first 6 metrics", () => {
    const manyMetrics: Record<string, number> = {};
    const keys = [
      "total_return", "annual_return", "sharpe", "max_drawdown",
      "win_rate", "trade_count", "calmar", "sortino",
    ];
    keys.forEach((k) => { manyMetrics[k] = 1; });

    renderWithI18n(<MetricsCard metrics={manyMetrics} compact />);

    // Should show the first 6 labels from DISPLAY_ORDER that exist
    expect(screen.getByText("Total Return")).toBeInTheDocument();
    expect(screen.getByText("Trades")).toBeInTheDocument();
    // Should NOT show 7th+ metric
    expect(screen.queryByText("Calmar")).not.toBeInTheDocument();
  });

  it("ignores metrics not in DISPLAY_ORDER", () => {
    const { container } = renderWithI18n(<MetricsCard metrics={{ unknown_metric: 999 }} />);
    expect(container.innerHTML).toBe("");
  });

  it("applies sentiment colors", () => {
    renderWithI18n(<MetricsCard metrics={{ sharpe: 1.5 }} />);
    // sharpe >= 1.0 → positive → text-success
    const el = screen.getByText("+1.50");
    expect(el.className).toContain("text-success");
  });

  it("applies negative sentiment for bad values", () => {
    renderWithI18n(<MetricsCard metrics={{ max_drawdown: -0.3 }} />);
    // max_drawdown <= -0.2 → negative → text-danger
    const el = screen.getByText("-30.00%");
    expect(el.className).toContain("text-danger");
  });
});
