import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Annotation } from "./annotations";
import { HIGHLIGHT_COLORS } from "./annotations";

export async function exportAnnotatedPdf(
  originalBytes: ArrayBuffer,
  annotations: Annotation[],
  fileName: string,
): Promise<void> {
  const doc = await PDFDocument.load(originalBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  for (const ann of annotations) {
    const page = pages[ann.page - 1];
    if (!page) continue;
    const { width: pw, height: ph } = page.getSize();

    if (ann.type === "highlight") {
      const color = HIGHLIGHT_COLORS[ann.color].rgb;
      for (const r of ann.rects) {
        page.drawRectangle({
          x: r.x * pw,
          y: ph - (r.y + r.h) * ph,
          width: r.w * pw,
          height: r.h * ph,
          color: rgb(color[0], color[1], color[2]),
          opacity: 0.4,
        });
      }
    } else if (ann.type === "text") {
      const fs = ann.fontSize;
      const lines = wrapText(ann.text, font, fs, ann.w * pw);
      let yTop = ann.y * ph;
      for (const line of lines) {
        yTop += fs * 1.2;
        page.drawText(line, {
          x: ann.x * pw,
          y: ph - yTop,
          size: fs,
          font,
          color: rgb(0, 0, 0),
        });
      }
    } else if (ann.type === "note") {
      const x = ann.x * pw;
      const y = ph - ann.y * ph;
      // Sticky icon
      page.drawRectangle({
        x,
        y: y - 14,
        width: 14,
        height: 14,
        color: rgb(1, 0.85, 0.2),
        borderColor: rgb(0.6, 0.45, 0),
        borderWidth: 0.5,
      });
      // Comment text next to it
      const fs = 9;
      const lines = wrapText(ann.text || "(nota)", font, fs, 180);
      let ly = y - 2;
      for (const line of lines) {
        page.drawText(line, {
          x: x + 18,
          y: ly - fs,
          size: fs,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
        ly -= fs * 1.25;
      }
    }
  }

  const bytes = await doc.save();
  // pdf-lib returns a Uint8Array (view into a possibly larger ArrayBuffer).
  // Copy into its own buffer so the Blob doesn't include unrelated memory.
  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes);
  const blob = new Blob([out], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = fileName.replace(/\.pdf$/i, "") || "documento";
  a.href = url;
  a.download = `${base}-annotato.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const paragraphs = text.split(/\n/);
  const out: string[] = [];
  for (const p of paragraphs) {
    if (!p) {
      out.push("");
      continue;
    }
    const words = p.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        line = test;
      } else {
        if (line) out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
  }
  return out;
}
