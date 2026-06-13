import { render, screen, act } from "@testing-library/react";
import { LanguageProvider, useI18n } from "../context";

function Probe() {
  const { t, lang, setLang } = useI18n();
  return (
    <>
      <span data-testid="val">{t("nav.home")}</span>
      <span data-testid="lang">{lang}</span>
      <button onClick={() => setLang("en")}>switch</button>
    </>
  );
}

describe("LanguageProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "";
  });

  it("defaults to zh", () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId("lang").textContent).toBe("zh");
    expect(screen.getByTestId("val").textContent).toBe("首页");
  });

  it("initializes from localStorage", () => {
    localStorage.setItem("vibe-lang", "en");
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("val").textContent).toBe("Home");
  });

  it("falls back to zh for invalid stored value", () => {
    localStorage.setItem("vibe-lang", "fr");
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId("lang").textContent).toBe("zh");
  });

  it("setLang persists and syncs <html lang>", () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    act(() => {
      screen.getByText("switch").click();
    });
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("val").textContent).toBe("Home");
    expect(localStorage.getItem("vibe-lang")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("throws when used outside Provider", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/useI18n.*Provider/i);
    err.mockRestore();
  });
});
