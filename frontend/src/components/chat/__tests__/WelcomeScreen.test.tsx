import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/i18n";
import { WelcomeScreen } from "../WelcomeScreen";

/** Render with i18n forced to English (tests assert against en dict). */
function renderWithI18n(ui: React.ReactElement) {
  localStorage.setItem("vibe-lang", "en");
  const result = render(<LanguageProvider>{ui}</LanguageProvider>);
  return result;
}

describe("WelcomeScreen", () => {
  const onExample = vi.fn();

  beforeEach(() => onExample.mockClear());

  it("renders the title", () => {
    renderWithI18n(<WelcomeScreen onExample={onExample} />);
    expect(screen.getByText("Vibe-Trading")).toBeInTheDocument();
  });

  it("renders capability chips", () => {
    renderWithI18n(<WelcomeScreen onExample={onExample} />);
    expect(screen.getByText("Finance Skills Library")).toBeInTheDocument();
    expect(screen.getByText("Swarm Agent Teams")).toBeInTheDocument();
    expect(screen.getByText("Shadow Account Backtest")).toBeInTheDocument();
  });

  it("renders example categories", () => {
    renderWithI18n(<WelcomeScreen onExample={onExample} />);
    expect(screen.getByText("Multi-Market Backtest")).toBeInTheDocument();
    expect(screen.getByText("Research & Analysis")).toBeInTheDocument();
    expect(screen.getByText("Swarm Teams")).toBeInTheDocument();
  });

  it("calls onExample with prompt when an example button is clicked", async () => {
    renderWithI18n(<WelcomeScreen onExample={onExample} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Cross-Market Portfolio"));
    expect(onExample).toHaveBeenCalledTimes(1);
    expect(onExample).toHaveBeenCalledWith(
      expect.stringContaining("risk-parity portfolio"),
    );
  });

  it("renders the helper text", () => {
    renderWithI18n(<WelcomeScreen onExample={onExample} />);
    expect(screen.getByText("Describe a trading strategy to get started.")).toBeInTheDocument();
    expect(screen.getByText("Try an example:")).toBeInTheDocument();
  });
});
