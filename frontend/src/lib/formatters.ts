import type { Vars } from "@/i18n/types";

export const METRIC_KEY_MAP: Record<string, string> = {
  total_return: "charts.metrics.total_return",
  annual_return: "charts.metrics.annual_return",
  sharpe: "charts.metrics.sharpe",
  max_drawdown: "charts.metrics.max_drawdown",
  win_rate: "charts.metrics.win_rate",
  trade_count: "charts.metrics.trade_count",
  final_value: "charts.metrics.final_value",
  calmar: "charts.metrics.calmar",
  sortino: "charts.metrics.sortino",
  profit_loss_ratio: "charts.metrics.profit_loss_ratio",
  max_consecutive_loss: "charts.metrics.max_consecutive_loss",
  avg_holding_days: "charts.metrics.avg_holding_days",
  benchmark_return: "charts.metrics.benchmark_return",
  excess_return: "charts.metrics.excess_return",
  information_ratio: "charts.metrics.information_ratio",
  annualized_return: "charts.metrics.annualized_return",
  calmar_ratio: "charts.metrics.calmar_ratio",
  sortino_ratio: "charts.metrics.sortino_ratio",
  volatility: "charts.metrics.volatility",
  profit_factor: "charts.metrics.profit_factor",
  avg_win: "charts.metrics.avg_win",
  avg_loss: "charts.metrics.avg_loss",
  max_consecutive_losses: "charts.metrics.max_consecutive_losses",
  exposure_time: "charts.metrics.exposure_time",
  avg_holding_period: "charts.metrics.avg_holding_period",
};

/** Resolve a metric key to its translated label via the provided loose translator (`tRaw`). */
export function getMetricLabel(
  k: string,
  resolve: (path: string, vars?: Vars) => string,
): string {
  const path = METRIC_KEY_MAP[k];
  return path ? resolve(path) : k;
}

const PCT_KEYS = ["total_return", "annual_return", "win_rate", "max_drawdown", "benchmark_return", "excess_return"];
const RATIO_KEYS = ["sharpe", "calmar", "sortino", "profit_loss_ratio", "information_ratio"];
const INT_KEYS = ["trade_count", "max_consecutive_loss"];
const NEUTRAL_KEYS = new Set(["trade_count", "avg_holding_days", "final_value"]);

export function formatMetricVal(k: string, v: number): string {
  if (PCT_KEYS.includes(k)) {
    const sign = v > 0 ? "+" : "";
    return `${sign}${(v * 100).toFixed(2)}%`;
  }
  if (RATIO_KEYS.includes(k)) {
    const sign = v > 0 ? "+" : "";
    return `${sign}${v.toFixed(2)}`;
  }
  if (INT_KEYS.includes(k)) return String(Math.round(v));
  if (k === "final_value") return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (k === "avg_holding_days") return v.toFixed(1);
  return v.toFixed(4);
}

export function metricSentiment(k: string, v: number): "positive" | "neutral" | "negative" {
  if (NEUTRAL_KEYS.has(k)) return "neutral";
  if (k === "max_drawdown") return v > -0.05 ? "positive" : v > -0.2 ? "neutral" : "negative";
  if (k === "max_consecutive_loss") return v <= 3 ? "positive" : v <= 6 ? "neutral" : "negative";
  if (k === "win_rate") return v >= 0.5 ? "positive" : v >= 0.35 ? "neutral" : "negative";
  if (k === "sharpe" || k === "calmar" || k === "sortino") return v >= 1.0 ? "positive" : v >= 0.3 ? "neutral" : "negative";
  if (k === "information_ratio") return v >= 0.5 ? "positive" : v >= 0 ? "neutral" : "negative";
  return v > 0 ? "positive" : v === 0 ? "neutral" : "negative";
}

export const DISPLAY_ORDER = [
  "total_return", "annualized_return", "sharpe", "max_drawdown", "volatility", "win_rate", "trade_count",
  "calmar_ratio", "sortino_ratio", "profit_factor", "avg_win", "avg_loss",
  "max_consecutive_losses", "exposure_time", "avg_holding_period",
  "annual_return", "calmar", "sortino", "profit_loss_ratio", "max_consecutive_loss", "avg_holding_days",
  "benchmark_return", "excess_return", "information_ratio", "final_value",
];

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function abbreviateNum(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (abs >= 1e4) return (v / 1e3).toFixed(0) + "K";
  return v.toLocaleString();
}
