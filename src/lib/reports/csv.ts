// Turns report rows into a CSV file that Excel, Google Sheets and LibreOffice open directly.

export type Cell = string | number | null | undefined;

/** Marks the file as UTF-8 so Excel shows ₹ and Tamil names correctly. */
const BOM = "﻿";

/**
 * One value as CSV text. Text that a spreadsheet would run as a formula
 * (starting with = + - @) gets a leading apostrophe, so a customer or part
 * name can never execute anything when the file is opened.
 */
export function csvCell(value: Cell): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A whole file: one line per row, Windows line ends. */
export function toCsv(rows: Cell[][]): string {
  return BOM + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** A name that is safe in a download header, e.g. "sales-by-item_2026-04-01_to_2026-11-13.csv". */
export function csvFileName(report: string, ...parts: string[]): string {
  const clean = [report, ...parts].map((p) => p.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "")).filter(Boolean);
  return `${clean.join("_")}.csv`;
}

/** Amount with exactly two decimals, as a number a spreadsheet can add up. */
export const money = (n: number): number => Math.round(n * 100) / 100;
