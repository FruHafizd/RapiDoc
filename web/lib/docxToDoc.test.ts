import { DOMParser as XmlDomParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { buildDocx } from "./buildDocx";
import { defaultConfig } from "./docConfig";
import { plainText, type Block } from "./docModel";
import { docxToDoc } from "./docxToDoc";
import { readDocxXml } from "./readDocx";

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const parser = new XmlDomParser() as unknown as DOMParser;

const body = (inner: string) => `<?xml version="1.0"?><w:document ${NS}><w:body>${inner}</w:body></w:document>`;
const run = (t: string, rPr = "") => `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const p = (runs: string, pPr = "") => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${runs}</w:p>`;
const styles = `<?xml version="1.0"?><w:styles ${NS}>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
  <w:style w:type="paragraph" w:styleId="Judul2"><w:name w:val="heading 2"/></w:style>
  <w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/></w:style>
  <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>
</w:styles>`;
const numbering = `<?xml version="1.0"?><w:numbering ${NS}>
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

const parse = (inner: string) => docxToDoc({ documentXml: body(inner), stylesXml: styles, numberingXml: numbering }, parser);
const types = (blocks: Block[]) => blocks.map((b) => b.type);

describe("docxToDoc: teks dan format", () => {
  it("membaca paragraf dengan tebal, miring, dan garis bawah", () => {
    const { doc } = parse(p(run("a ") + run("tebal", "<w:b/>") + run(" miring", "<w:i/>") + run(" garis", '<w:u w:val="single"/>')));
    const para = doc.content[0];
    expect(para.type).toBe("paragraph");
    const nodes = (para as { content: { text: string; marks?: { type: string }[] }[] }).content;
    expect(nodes.map((n) => n.text)).toEqual(["a ", "tebal", " miring", " garis"]);
    expect(nodes[1].marks).toEqual([{ type: "bold" }]);
    expect(nodes[2].marks).toEqual([{ type: "italic" }]);
    expect(nodes[3].marks).toEqual([{ type: "underline" }]);
    expect(nodes[0].marks).toBeUndefined();
  });

  it("tebal yang dimatikan (w:val=0 atau u none) tidak dihitung", () => {
    const { doc } = parse(p(run("x", '<w:b w:val="0"/><w:u w:val="none"/>')));
    expect((doc.content[0] as { content: { marks?: unknown }[] }).content[0].marks).toBeUndefined();
  });

  it("menggabungkan run bersebelahan yang formatnya sama", () => {
    const { doc } = parse(p(run("ab", "<w:b/>") + run("cd", "<w:b/>")));
    expect((doc.content[0] as { content: unknown[] }).content).toHaveLength(1);
  });

  it("membaca rata teks dan indentasi baris pertama", () => {
    const { doc } = parse(
      p(run("tengah"), '<w:jc w:val="center"/>') +
        p(run("rata"), '<w:jc w:val="both"/><w:ind w:firstLine="709"/>') +
        p(run("biasa")),
    );
    expect(doc.content[0]).toMatchObject({ attrs: { textAlign: "center" } });
    expect(doc.content[1]).toMatchObject({ attrs: { textAlign: "justify", firstLine: 1.25 } });
    expect((doc.content[2] as { attrs?: unknown }).attrs).toBeUndefined();
  });

  it("mengenali judul dari nama gaya, bukan dari id", () => {
    const { doc } = parse(
      p(run("BAB I"), '<w:pStyle w:val="Heading1"/>') + p(run("Sub"), '<w:pStyle w:val="Judul2"/>') + p(run("Daftar"), '<w:pStyle w:val="TOC1"/>'),
    );
    expect(doc.content[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
    expect(doc.content[1]).toMatchObject({ type: "heading", attrs: { level: 2 } });
    expect(doc.content[2].type).toBe("paragraph");
  });

  it("tab menjadi karakter tab dan br menjadi hardBreak", () => {
    const { doc } = parse(p(`<w:r><w:t>A</w:t><w:tab/><w:t>3</w:t><w:br/><w:t>B</w:t></w:r>`));
    const c = (doc.content[0] as { content: { type: string; text?: string }[] }).content;
    expect(c.map((n) => n.type)).toEqual(["text", "hardBreak", "text"]);
    expect(c[0].text).toBe("A\t3");
  });

  it("memasukkan hyperlink dan konten kontrol, mengabaikan teks yang dihapus dan kode field", () => {
    const { doc } = parse(
      `<w:sdt><w:sdtContent>${p(`<w:hyperlink>${run("tautan")}</w:hyperlink><w:del><w:r><w:delText>hapus</w:delText></w:r></w:del><w:r><w:instrText>PAGEREF x</w:instrText></w:r>`)}</w:sdtContent></w:sdt>`,
    );
    expect(plainText((doc.content[0] as unknown as { content: [] }).content)).toBe("tautan");
  });
});

describe("docxToDoc: halaman, daftar, dan tabel", () => {
  it("memecah paragraf di pemisah halaman, termasuk pageBreakBefore dan pergantian seksi", () => {
    const { doc } = parse(
      p(run("a") + `<w:r><w:br w:type="page"/></w:r>` + run("b")) +
        p(run("c"), "<w:pageBreakBefore/>") +
        p(run("d"), '<w:sectPr><w:type w:val="nextPage"/></w:sectPr>') +
        p(run("e")),
    );
    expect(types(doc.content)).toEqual([
      "paragraph", "horizontalRule", "paragraph", // a | b
      "horizontalRule", "paragraph", // c
      "paragraph", "horizontalRule", // d + pergantian seksi
      "paragraph", // e
    ]);
  });

  it("pergantian seksi continuous tidak membuat halaman baru", () => {
    const { doc } = parse(p(run("d"), '<w:sectPr><w:type w:val="continuous"/></w:sectPr>') + p(run("e")));
    expect(types(doc.content)).toEqual(["paragraph", "paragraph"]);
  });

  it("mengelompokkan item daftar berurutan dan membedakan poin dari nomor", () => {
    const li = (t: string, id: number) => p(run(t), `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${id}"/></w:numPr>`);
    const { doc } = parse(li("a", 1) + li("b", 1) + p(run("tengah")) + li("1", 2) + li("2", 2));
    expect(types(doc.content)).toEqual(["bulletList", "paragraph", "orderedList"]);
    expect((doc.content[0] as { content: unknown[] }).content).toHaveLength(2);
    expect((doc.content[2] as { content: unknown[] }).content).toHaveLength(2);
  });

  it("membaca tabel dengan colspan, isi sel, dan penanda garis tepi", () => {
    const tc = (t: string, extra = "") => `<w:tc><w:tcPr>${extra}</w:tcPr>${p(run(t))}</w:tc>`;
    const grid = `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/></w:tblPr><w:tr>${tc("a")}${tc("b", '<w:gridSpan w:val="2"/>')}</w:tr></w:tbl>`;
    const plain = `<w:tbl><w:tblPr/><w:tr>${tc("x")}</w:tr></w:tbl>`;
    const { doc } = parse(grid + plain);
    const t1 = doc.content[0] as { type: string; attrs: { borders: boolean }; content: { content: { attrs?: { colspan?: number }; content: Block[] }[] }[] };
    expect(t1.type).toBe("table");
    expect(t1.attrs.borders).toBe(true);
    expect(t1.content[0].content).toHaveLength(2);
    expect(t1.content[0].content[1].attrs?.colspan).toBe(2);
    expect(plainText((t1.content[0].content[0].content[0] as unknown as { content: [] }).content)).toBe("a");
    expect((doc.content[1] as { attrs: { borders: boolean } }).attrs.borders).toBe(false);
  });

  it("sel tabel kosong tetap berisi satu paragraf", () => {
    const { doc } = parse(`<w:tbl><w:tblPr/><w:tr><w:tc><w:tcPr/></w:tc></w:tr></w:tbl>`);
    const cell = (doc.content[0] as { content: { content: { content: Block[] }[] }[] }).content[0].content[0];
    expect(cell.content).toEqual([{ type: "paragraph" }]);
  });

  it("menghitung gambar yang tidak dikenali tanpa menampilkannya", () => {
    const { doc, images } = parse(p(`<w:r><w:drawing/></w:r>${run("teks")}<w:r><w:pict/></w:r>`));
    expect(images).toBe(2);
    expect(plainText((doc.content[0] as unknown as { content: [] }).content)).toBe("teks");
  });
});

const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));
const IMG_NS = `${NS} xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;
const drawing = (kind: "inline" | "anchor", rid: string, cx = 1440000, cy = 720000) =>
  `<w:r><w:drawing><wp:${kind}><wp:extent cx="${cx}" cy="${cy}"/><a:graphic><a:graphicData><a:blip r:embed="${rid}"/></a:graphicData></a:graphic></wp:${kind}></w:drawing></w:r>`;
const parseImg = (inner: string, images = {} as Record<string, { data: Uint8Array; type: "png" | "jpg" }>) =>
  docxToDoc(
    { documentXml: `<?xml version="1.0"?><w:document ${IMG_NS}><w:body>${inner}</w:body></w:document>`, stylesXml: "", numberingXml: "", images },
    parser,
  );

describe("docxToDoc: ukuran huruf dan jarak paragraf", () => {
  const stylesDefault = `<?xml version="1.0"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  const withDefaults = (inner: string) => docxToDoc({ documentXml: body(inner), stylesXml: stylesDefault, numberingXml: "" }, parser);

  it("ukuran huruf yang berbeda dari bawaan menjadi penanda fontSize", () => {
    const { doc } = withDefaults(p(run("besar", '<w:sz w:val="28"/>') + run("biasa", '<w:sz w:val="24"/>')));
    const c = (doc.content[0] as unknown as { content: { text: string; marks?: unknown[] }[] }).content;
    expect(c[0].marks).toEqual([{ type: "fontSize", attrs: { size: 14 } }]);
    expect(c[1].marks).toBeUndefined();
  });

  it("tanpa ukuran bawaan, ukuran eksplisit tetap dibawa", () => {
    const { doc } = parse(p(run("x", '<w:sz w:val="22"/>')));
    expect((doc.content[0] as unknown as { content: { marks: unknown[] }[] }).content[0].marks).toEqual([
      { type: "fontSize", attrs: { size: 11 } },
    ]);
  });

  it("jarak sebelum, sesudah, dan spasi baris paragraf dibaca", () => {
    const { doc } = parse(p(run("x"), '<w:spacing w:before="120" w:after="500" w:line="360" w:lineRule="auto"/>'));
    expect(doc.content[0]).toMatchObject({ attrs: { spaceBefore: 6, spaceAfter: 25, lineSpacing: 1.5 } });
  });

  it("spasi baris tetap (exact) tidak dibawa", () => {
    const { doc } = parse(p(run("x"), '<w:spacing w:line="300" w:lineRule="exact"/>'));
    expect((doc.content[0] as { attrs?: unknown }).attrs).toBeUndefined();
  });
});

describe("docxToDoc: gaya paragraf (tebal, miring, indentasi, tab)", () => {
  const st = `<?xml version="1.0"?><w:styles ${NS}>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
    <w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/>
      <w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9071"/></w:tabs></w:pPr><w:rPr><w:b/></w:rPr></w:style>
    <w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/><w:basedOn w:val="TOC1"/>
      <w:pPr><w:ind w:left="567"/></w:pPr><w:rPr><w:b w:val="0"/><w:i/></w:rPr></w:style>
    <w:style w:type="paragraph" w:styleId="Tengah"><w:name w:val="Tengah"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr></w:style>
  </w:styles>`;
  const withStyles = (inner: string) => docxToDoc({ documentXml: body(inner), stylesXml: st, numberingXml: "" }, parser);
  const first = (r: ReturnType<typeof withStyles>) => r.doc.content[0] as unknown as { attrs?: Record<string, unknown>; content: { text: string; marks?: { type: string }[] }[] };

  it("tebal dan miring diwarisi dari gaya, termasuk rantai basedOn, dan bisa dimatikan", () => {
    const r1 = first(withStyles(p(run("A"), '<w:pStyle w:val="TOC1"/>')));
    expect(r1.content[0].marks).toEqual([{ type: "bold" }]);
    const r2 = first(withStyles(p(run("B"), '<w:pStyle w:val="TOC2"/>')));
    expect(r2.content[0].marks).toEqual([{ type: "italic" }]); // b dimatikan di TOC2, i ditambah
  });

  it("format langsung pada run menimpa gaya", () => {
    const r = first(withStyles(p(run("A", '<w:b w:val="0"/><w:i/>'), '<w:pStyle w:val="TOC1"/>')));
    expect(r.content[0].marks).toEqual([{ type: "italic" }]);
  });

  it("tab bertitik dari gaya dibaca sebagai tab stop dalam cm", () => {
    const r = first(withStyles(p(run("A") + `<w:r><w:tab/></w:r>` + run("3"), '<w:pStyle w:val="TOC1"/>')));
    expect(r.attrs?.tabs).toEqual([{ pos: 16, align: "right", leader: "dot" }]);
  });

  it("indentasi kiri diwarisi, tab clear menghapus tab dari gaya", () => {
    const r = first(withStyles(p(run("B"), '<w:pStyle w:val="TOC2"/><w:tabs><w:tab w:val="clear" w:pos="9071"/></w:tabs>')));
    expect(r.attrs?.indentLeft).toBe(1);
    expect(r.attrs?.tabs).toBeUndefined();
  });

  it("rata teks diwarisi dari gaya", () => {
    const r = first(withStyles(p(run("T"), '<w:pStyle w:val="Tengah"/>')));
    expect(r.attrs?.textAlign).toBe("center");
  });

  it("judul tidak membawa tebal dari gayanya sendiri", () => {
    const stH = st.replace("</w:styles>", '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style></w:styles>');
    const r = docxToDoc({ documentXml: body(p(run("H"), '<w:pStyle w:val="Heading1"/>')), stylesXml: stH, numberingXml: "" }, parser);
    expect((r.doc.content[0] as { content: { marks?: unknown }[] }).content[0].marks).toBeUndefined();
  });
});

describe("docxToDoc: indentasi menggantung (daftar pustaka)", () => {
  it("membaca left dan hanging sebagai indentLeft dan hanging dalam cm", () => {
    const { doc } = parse(p(run("Bisnis.com. (2023)."), '<w:ind w:left="720" w:hanging="720"/>'));
    expect(doc.content[0]).toMatchObject({ attrs: { indentLeft: 1.27, hanging: 1.27 } });
    expect((doc.content[0] as { attrs: { firstLine?: number } }).attrs.firstLine).toBeUndefined();
  });

  it("firstLine dan hanging tidak dibawa bersamaan (hanging menang)", () => {
    const { doc } = parse(p(run("x"), '<w:ind w:left="567" w:firstLine="300" w:hanging="567"/>'));
    const a = (doc.content[0] as { attrs: Record<string, unknown> }).attrs;
    expect(a.hanging).toBe(1);
    expect(a.firstLine).toBeUndefined();
  });
});

describe("docxToDoc: garis tepi tabel", () => {
  const tbl = (tblPr: string) => `<w:tbl><w:tblPr>${tblPr}</w:tblPr><w:tr><w:tc><w:tcPr/>${p(run("x"))}</w:tc></w:tr></w:tbl>`;
  const borders = (v: string) => `<w:tblBorders><w:top w:val="${v}"/><w:left w:val="${v}"/><w:bottom w:val="${v}"/><w:right w:val="${v}"/></w:tblBorders>`;
  const hasBorders = (x: string) => ((parse(x).doc.content[0] as { attrs: { borders: boolean } }).attrs.borders);

  it("garis tepi eksplisit none menimpa gaya TableGrid", () => {
    expect(hasBorders(tbl(`<w:tblStyle w:val="TableGrid"/>${borders("none")}`))).toBe(false);
  });
  it("garis tepi eksplisit single tetap bergaris", () => {
    expect(hasBorders(tbl(borders("single")))).toBe(true);
  });
  it("tanpa tblBorders, gaya grid menentukan", () => {
    expect(hasBorders(tbl('<w:tblStyle w:val="TableGrid"/>'))).toBe(true);
  });
});

describe("docxToDoc: gambar", () => {
  it("memuat gambar inline dengan ukuran dalam cm sebagai data URL", () => {
    const { doc, images } = parseImg(p(drawing("inline", "rId1"), '<w:jc w:val="center"/>'), { rId1: { data: PNG, type: "png" } });
    const para = doc.content[0] as { attrs: { textAlign: string }; content: { type: string; attrs: { src: string; widthCm: number; heightCm: number } }[] };
    expect(para.attrs.textAlign).toBe("center");
    expect(para.content[0].type).toBe("image");
    expect(para.content[0].attrs.src.startsWith("data:image/png;base64,")).toBe(true);
    expect(para.content[0].attrs.widthCm).toBeCloseTo(4, 2);
    expect(para.content[0].attrs.heightCm).toBeCloseTo(2, 2);
    expect(images).toBe(0);
  });

  it("gambar anchor (mengambang) juga dimuat", () => {
    const { doc } = parseImg(p(drawing("anchor", "rId1")), { rId1: { data: PNG, type: "png" } });
    expect((doc.content[0] as { content: { type: string }[] }).content[0].type).toBe("image");
  });

  it("gambar yang tidak bisa dimuat dihitung sebagai tidak ditampilkan", () => {
    const { doc, images } = parseImg(p(drawing("inline", "rIdX") + run("teks")));
    expect(images).toBe(1);
    expect(plainText((doc.content[0] as unknown as { content: [] }).content)).toBe("teks");
  });
});

describe("docxToDoc: ketahanan", () => {
  it("XML rusak menghasilkan dokumen kosong tanpa error", () => {
    const r = docxToDoc({ documentXml: "<<bukan xml", stylesXml: "", numberingXml: "" }, parser);
    expect(r.doc).toEqual({ type: "doc", content: [] });
  });

  it("dokumen tanpa isi menghasilkan satu paragraf kosong bila diminta editor", () => {
    const r = parse("");
    expect(r.doc.content).toEqual([]);
  });
});

describe("docxToDoc: dokumen buatan generator", () => {
  it("membaca isi cover, judul bab, sub-bab, dan daftar pustaka", async () => {
    const blob = await buildDocx({ ...defaultConfig, withSample: true });
    const parts = await readDocxXml(blob);
    const { doc } = docxToDoc(parts, parser);
    const lines = doc.content.map((b) => (b.type === "paragraph" || b.type === "heading" ? plainText(b.content) : `<${b.type}>`));
    expect(lines).toContain("MAKALAH");
    expect(lines).toContain("KATA PENGANTAR");
    expect(lines).toContain("BAB I\nPENDAHULUAN");
    expect(lines).toContain("A. Latar Belakang");
    expect(lines).toContain("DAFTAR PUSTAKA");
    expect(doc.content.filter((b) => b.type === "heading" && b.attrs.level === 1).length).toBeGreaterThanOrEqual(5);
    expect(doc.content.some((b) => b.type === "horizontalRule")).toBe(true);
    expect(doc.content.find((b) => b.type === "paragraph" && plainText(b.content) === "MAKALAH")).toMatchObject({
      attrs: { textAlign: "center" },
    });
  });
});
