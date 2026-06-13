import React from "react";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";
import { LanguageProvider } from "@/i18n";

function Thrower({ message }: { message: string }): React.ReactElement {
  throw new Error(message);
}

// Suppress React error boundary console.error in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("ErrorBoundary")) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

describe("ErrorBoundary", () => {
  it("renders children normally when no error", () => {
    render(
      <LanguageProvider>
        <ErrorBoundary>
          <div>Hello World</div>
        </ErrorBoundary>
      </LanguageProvider>,
    );
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders default fallback with error message on error", () => {
    render(
      <LanguageProvider>
        <ErrorBoundary>
          <Thrower message="Something broke" />
        </ErrorBoundary>
      </LanguageProvider>,
    );
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <LanguageProvider>
        <ErrorBoundary fallback={<div>Custom fallback</div>}>
          <Thrower message="ignored" />
        </ErrorBoundary>
      </LanguageProvider>,
    );
    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
    expect(screen.queryByText("ignored")).not.toBeInTheDocument();
  });

  it("shows default message when error has no message", () => {
    function ThrowEmpty(): React.ReactElement {
      throw {};
    }
    render(
      <LanguageProvider>
        <ErrorBoundary>
          <ThrowEmpty />
        </ErrorBoundary>
      </LanguageProvider>,
    );
    // Default lang is zh; t("errorBoundary.title") yields "出错了"
    expect(screen.getByText("出错了")).toBeInTheDocument();
  });
});
