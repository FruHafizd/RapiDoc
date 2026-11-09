import { DOMParser as XmlDomParser } from "@xmldom/xmldom";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { detectFormat } from "./detectFormat";
import { plainText, type DocNode } from "./docModel";
import { docToDocx, type ExportFormat } from "./docToDocx";
import { docxToDoc } from "./docxToDoc";
import { readDocxXml } from "./readDocx";

const parser = new XmlDomParser() as unknown as DOMParser;

const format: ExportFormat = {
  paper: "A4",
  margins: { top: 4, bottom: 3, left: 4, right: 3 },
  font: "Times New Roman",
  fontSize: 12,
  lineSpacing: 2,
  pageNumbers: true,
  pageNumberPosition: "bottom-center",
  skipFirstPage: false,
};

const t = (text: string, ...marks: ("bold" | "italic" | "underline")[]) => ({
  type: "text" as const,
  text,
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
});

const rich: DocNode = {
  type: "doc",
  content: [
    { type: "paragraph", attrs: { textAlign: "center" }, content: [t("JUDUL", "bold")] },
    { type: "heading", attrs: { level: 1, textAlign: "center" }, content: [t("BAB I"), { type: "hardBreak" }, t("PENDAHULUAN")] },
    { type: "heading", attrs: { level: 2 }, content: [t("A. Latar Belakang")] },
    {
      type: "paragraph",
      attrs: { textAlign: "justify", firstLine: 1.25 },
      content: [t("biasa "), t("tebal", "bold"), t(" "), t("miring", "italic"), t(" "), t("garis", "underline"), t("\tdengan tab")],
    },
    { type: "paragraph" },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [t("poin satu")] }] }, { type: "listItem", content: [{ type: "paragraph", content: [t("poin dua")] }] }] },
    { type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [t("langkah satu")] }] }] },
    {
      type: "table",
      attrs: { borders: false },
      content: [
        { type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [t("Nama")] }] }, { type: "tableCell", content: [{ type: "paragraph", content: [t(": Budi")] }] }] },
        { type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 2 }, content: [{ type: "paragraph", content: [t("gabung")] }] }] },
      ],
    },
    { type: "horizontalRule" },
    { type: "paragraph", content: [t("halaman dua")] },
  ],
};

async function roundTrip(doc: DocNode, fmt: ExportFormat = format) {
  const blob = await docToDocx(doc, fmt);
  const parts = await readDocxXml(blob);
  return { parts, back: docxToDoc(parts, parser).doc, blob };
}

describe("docToDocx: round trip isi", () => {
  it("isi, format teks, daftar, tabel, dan pemisah halaman kembali sama setelah ekspor lalu impor", async () => {
    const { back } = await roundTrip(rich);
    expect(back.content).toEqual(rich.content);
  });

  it("tabel dengan garis tepi dikenali kembali", async () => {
    const doc: DocNode = {
      type: "doc",
      content: [{ type: "table", attrs: { borders: true }, content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [t("x")] }] }] }] }],
    };
    const { back, parts } = await roundTrip(doc);
    expect((back.content[0] as { attrs: { borders: boolean } }).attrs.borders).toBe(true);
    expect(parts.documentXml.match(/<w:tblBorders>[\s\S]*?<\/w:tblBorders>/)?.[0]).toContain('w:val="single"');
  });

  it("tabel tanpa garis tepi tidak digambar bergaris", async () => {
    const { parts } = await roundTrip(rich);
    const tblBorders = parts.documentXml.match(/<w:tblBorders>[\s\S]*?<\/w:tblBorders>/)?.[0] ?? "";
    expect(tblBorders).not.toBe("");
    expect(tblBorders).not.toContain('w:val="single"');
  });
});

describe("docToDocx: format halaman", () => {
  it("menerapkan kertas, margin, font, ukuran, dan spasi baris", async () => {
    const { parts } = await roundTrip(rich);
    const { patch } = detectFormat(parts.documentXml, parts.stylesXml);
    expect(patch.paper).toBe("A4");
    expect(patch.margins).toEqual({ top: 4, bottom: 3, left: 4, right: 3 });
    expect(patch.font).toBe("Times New Roman");
    expect(patch.fontSize).toBe(12);
    expect(patch.lineSpacing).toBe(2);
  });

  it("memakai Letter dan font lain bila diminta", async () => {
    const { parts } = await roundTrip(rich, { ...format, paper: "Letter", font: "Arial", fontSize: 11, lineSpacing: 1 });
    const { patch } = detectFormat(parts.documentXml, parts.stylesXml);
    expect(patch).toMatchObject({ paper: "Letter", font: "Arial", fontSize: 11, lineSpacing: 1 });
  });

  it("nomor halaman hanya ada bila diminta", async () => {
    const on = await roundTrip(rich, { ...format, pageNumbers: true });
    expect(on.parts.footerXmls.join("")).toContain("PAGE");
    const off = await roundTrip(rich, { ...format, pageNumbers: false });
    expect(off.parts.footerXmls).toHaveLength(0);
  });

  it("tab diekspor sebagai tab Word, bukan karakter mentah", async () => {
    const { parts } = await roundTrip(rich);
    expect(parts.documentXml).toContain("<w:tab/>");
  });
});

describe("docToDocx: posisi nomor halaman", () => {
  const doc: DocNode = { type: "doc", content: [{ type: "paragraph", content: [t("isi")] }] };

  it("atas kanan memakai header, bukan footer", async () => {
    const { parts } = await roundTrip(doc, { ...format, pageNumberPosition: "top-right" });
    expect(parts.headerXmls.join("")).toContain("PAGE");
    expect(parts.headerXmls.join("")).toContain('w:val="right"');
    expect(parts.footerXmls).toHaveLength(0);
  });

  it("bawah kanan memakai footer rata kanan", async () => {
    const { parts } = await roundTrip(doc, { ...format, pageNumberPosition: "bottom-right" });
    expect(parts.footerXmls.join("")).toContain('w:val="right"');
    expect(parts.headerXmls).toHaveLength(0);
  });

  it("tanpa nomor di halaman pertama juga berlaku untuk header", async () => {
    const { parts } = await roundTrip(doc, { ...format, pageNumberPosition: "top-right", skipFirstPage: true });
    expect(parts.documentXml).toContain("<w:titlePg/>");
    expect(parts.headerXmls).toHaveLength(2); // default + halaman pertama kosong
  });
});

describe("docToDocx: ukuran huruf, jarak paragraf, dan halaman pertama", () => {
  const doc: DocNode = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { textAlign: "center", spaceBefore: 6, spaceAfter: 25, lineSpacing: 1.5 },
        content: [{ type: "text", text: "Besar", marks: [{ type: "bold" }, { type: "fontSize", attrs: { size: 14 } }] }, t(" biasa")],
      },
    ],
  };

  it("ukuran huruf dan jarak paragraf kembali sama setelah ekspor lalu impor", async () => {
    const { back } = await roundTrip(doc, { ...format, fontSize: 12 });
    expect(back.content).toEqual(doc.content);
  });

  it("tanpa nomor di halaman pertama bila diminta", async () => {
    const skip = await roundTrip(doc, { ...format, pageNumbers: true, skipFirstPage: true });
    expect(skip.parts.documentXml).toContain("<w:titlePg/>");
    const keep = await roundTrip(doc, { ...format, pageNumbers: true, skipFirstPage: false });
    expect(keep.parts.documentXml).not.toContain("<w:titlePg");
  });
});

describe("docToDocx: indentasi kiri dan tab stop", () => {
  const doc: DocNode = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { indentLeft: 1, tabs: [{ pos: 16, align: "right", leader: "dot" }] },
        content: [t("Latar Belakang	3", "italic")],
      },
    ],
  };

  it("indentasi kiri dan tab bertitik kembali sama setelah ekspor lalu impor", async () => {
    const { back, parts } = await roundTrip(doc);
    expect(parts.documentXml).toContain("<w:tabs>");
    const para = back.content[0] as unknown as { attrs: { indentLeft: number; tabs: { pos: number; align: string; leader: string }[] } };
    expect(para.attrs.indentLeft).toBeCloseTo(1, 1);
    expect(para.attrs.tabs).toHaveLength(1);
    expect(para.attrs.tabs[0]).toMatchObject({ align: "right", leader: "dot" });
    expect(para.attrs.tabs[0].pos).toBeCloseTo(16, 1);
  });
});

describe("docToDocx: indentasi menggantung", () => {
  const doc: DocNode = {
    type: "doc",
    content: [{ type: "paragraph", attrs: { indentLeft: 1.27, hanging: 1.27 }, content: [t("Bisnis.com. (2023, 21 Desember). Survei SMRC.")] }],
  };

  it("indentasi menggantung kembali sama dan XML memakai w:hanging, bukan w:firstLine", async () => {
    const { back, parts } = await roundTrip(doc);
    expect(parts.documentXml).toContain("w:hanging=");
    expect(parts.documentXml).not.toContain("w:firstLine=");
    const a = (back.content[0] as { attrs: { indentLeft: number; hanging: number } }).attrs;
    expect(a.indentLeft).toBeCloseTo(1.27, 1);
    expect(a.hanging).toBeCloseTo(1.27, 1);
  });
});

describe("docToDocx: gambar", () => {
  const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const src = `data:image/png;base64,${PNG_B64}`;
  const withImage: DocNode = {
    type: "doc",
    content: [{ type: "paragraph", attrs: { textAlign: "center" }, content: [{ type: "image", attrs: { src, widthCm: 4, heightCm: 2 } }, t("setelah gambar")] }],
  };

  it("gambar kembali sama setelah ekspor lalu impor", async () => {
    const { back } = await roundTrip(withImage);
    const para = back.content[0] as unknown as { attrs: { textAlign: string }; content: { type: string; attrs?: { src: string; widthCm: number; heightCm: number }; text?: string }[] };
    expect(para.attrs.textAlign).toBe("center");
    expect(para.content[0].type).toBe("image");
    expect(para.content[0].attrs?.src).toBe(src);
    expect(para.content[0].attrs?.widthCm).toBeCloseTo(4, 1);
    expect(para.content[0].attrs?.heightCm).toBeCloseTo(2, 1);
    expect(para.content[1].text).toBe("setelah gambar");
  });

  it("gambar dengan sumber bukan data URL dilewati tanpa merusak berkas", async () => {
    const doc: DocNode = { type: "doc", content: [{ type: "paragraph", content: [{ type: "image", attrs: { src: "https://contoh.test/x.png", widthCm: 3, heightCm: 3 } }, t("aman")] }] };
    const { back } = await roundTrip(doc);
    expect(plainText((back.content[0] as unknown as { content: [] }).content)).toBe("aman");
  });
});

describe("docToDocx: ketahanan", () => {
  it("dokumen kosong tetap menghasilkan .docx yang valid", async () => {
    const { blob, back } = await roundTrip({ type: "doc", content: [] });
    const zip = await JSZip.loadAsync(blob);
    expect(zip.file("word/document.xml")).not.toBeNull();
    expect(back.content.length).toBeLessThanOrEqual(1);
  });

  it("teks dengan karakter khusus XML dan emoji tidak merusak berkas", async () => {
    const doc: DocNode = { type: "doc", content: [{ type: "paragraph", content: [t('A & B <C> "D" \u{1F600}')] }] };
    const { back } = await roundTrip(doc);
    expect(back.content).toEqual(doc.content);
  });
});
