// Excel が UTF-8 を正しく開けるよう BOM を付ける
const BOM = "﻿";

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))];
  return BOM + lines.join("\r\n");
}

// HTTPヘッダーはASCIIしか運べないので、日本語ファイル名は RFC 5987 の filename* で渡す
export function csvResponse(filename: string, csv: string, asciiFallback: string): Response {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `${filename}-${stamp}.csv`;
  const disposition =
    `attachment; filename="${asciiFallback}-${stamp}.csv"; ` +
    `filename*=UTF-8''${encodeURIComponent(name)}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": disposition,
      "Cache-Control": "no-store",
    },
  });
}
