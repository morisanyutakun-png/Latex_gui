/**
 * クライアント生成 PDF — バックエンドの compile-raw が完全停止しても、ユーザに
 * 「PDF っぽい何か」を必ず見せるための最終保険。Helvetica で 1〜2 行テキストを置く
 * 最小構成 (~700 バイト)。Vercel Edge / モバイル Safari でも一発で開ける。
 *
 * NOTE: PDF format requires byte-accurate xref offsets. Build by concatenating
 * Latin-1-only strings and recompute offsets at runtime. Helvetica は WinAnsi
 * 範囲のみ描画できるため、入れる文字は ASCII printable に限定する。
 */
export function buildClientFallbackPdf(line1: string, line2: string = ""): Blob {
  const safeAscii = (s: string) =>
    s
      .replace(/[\\()]/g, (m) => "\\" + m)
      .replace(/[^\x20-\x7E]/g, "?")
      .slice(0, 80);
  const t1 = safeAscii(line1) || "Worksheet ready";
  const t2 = safeAscii(line2) || "";
  const stream =
    "BT\n" +
    "/F1 22 Tf\n" +
    `72 720 Td (${t1}) Tj\n` +
    (t2 ? `0 -28 Td /F1 13 Tf (${t2}) Tj\n` : "") +
    "ET\n";
  const header = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const objs: string[] = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`,
  ];
  const offsets: number[] = [];
  let pos = header.length;
  for (const o of objs) {
    offsets.push(pos);
    pos += o.length;
  }
  const xrefStart = pos;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  const fullStr = header + objs.join("") + xref + trailer;
  const bytes = new Uint8Array(fullStr.length);
  for (let i = 0; i < fullStr.length; i++) bytes[i] = fullStr.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
}
