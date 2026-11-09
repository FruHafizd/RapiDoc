import { describe, expect, it } from "vitest";
import { detectPageNumbers } from "./detectPageNumbers";

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const part = (jc: string | null, field: "PAGE" | "TEXT" | "FLD") => {
  const pPr = jc ? `<w:pPr><w:jc w:val="${jc}"/></w:pPr>` : "";
  const run =
    field === "PAGE"
      ? `<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>`
      : field === "FLD"
        ? `<w:fldSimple w:instr=" PAGE \* MERGEFORMAT"><w:r><w:t>1</w:t></w:r></w:fldSimple>`
        : `<w:r><w:t>Judul</w:t></w:r>`;
  return `<w:ftr ${NS}><w:p>${pPr}${run}</w:p></w:ftr>`;
};

describe("detectPageNumbers", () => {
  it("tanpa header/footer berarti tanpa nomor halaman", () => {
    expect(detectPageNumbers([], [])).toEqual({ enabled: false, position: "bottom-center" });
  });

  it("nomor di footer tengah", () => {
    expect(detectPageNumbers([], [part("center", "PAGE")])).toEqual({ enabled: true, position: "bottom-center" });
  });

  it("nomor di footer tanpa jc dianggap kiri, dilaporkan sebagai bawah kanan terdekat yang didukung", () => {
    expect(detectPageNumbers([], [part("right", "PAGE")])).toEqual({ enabled: true, position: "bottom-right" });
  });

  it("nomor di header kanan menjadi atas kanan", () => {
    expect(detectPageNumbers([part("right", "PAGE")], [part(null, "TEXT")])).toEqual({ enabled: true, position: "top-right" });
  });

  it("field sederhana (fldSimple) juga dikenali", () => {
    expect(detectPageNumbers([], [part("center", "FLD")]).enabled).toBe(true);
  });

  it("teks biasa bukan nomor halaman", () => {
    expect(detectPageNumbers([part(null, "TEXT")], [part(null, "TEXT")]).enabled).toBe(false);
  });

  it("header yang bukan kanan jatuh ke atas kanan juga bila ada nomor (posisi atas didukung hanya kanan)", () => {
    expect(detectPageNumbers([part("center", "PAGE")], []).position).toBe("top-right");
  });
});
