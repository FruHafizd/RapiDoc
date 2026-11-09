import { describe, expect, it } from "vitest";
import { buildDocx } from "./buildDocx";
import { defaultConfig, presets, type DocConfig } from "./docConfig";
import { detectFormat } from "./detectFormat";
import { readDocxXml } from "./readDocx";

async function roundTrip(config: DocConfig) {
  const { documentXml, stylesXml } = await readDocxXml(await buildDocx(config));
  return detectFormat(documentXml, stylesXml);
}

describe("detectFormat: round trip dengan dokumen buatan generator", () => {
  it("mendeteksi format Umum Indonesia", async () => {
    const { patch } = await roundTrip(defaultConfig);
    expect(patch.paper).toBe("A4");
    expect(patch.margins).toEqual({ top: 3, bottom: 3, left: 4, right: 3 });
    expect(patch.font).toBe("Times New Roman");
    expect(patch.fontSize).toBe(12);
    expect(patch.lineSpacing).toBe(1.5);
  });

  it("mendeteksi preset APA (Letter, margin 2,54, spasi 2)", async () => {
    const apa = presets.find((p) => p.id === "apa")!.config;
    const { patch } = await roundTrip(apa);
    expect(patch.paper).toBe("Letter");
    expect(patch.margins).toEqual({ top: 2.54, bottom: 2.54, left: 2.54, right: 2.54 });
    expect(patch.lineSpacing).toBe(2);
  });

  it("mendeteksi font dan ukuran lain", async () => {
    const { patch } = await roundTrip({ ...defaultConfig, font: "Arial", fontSize: 11, lineSpacing: 1 });
    expect(patch.font).toBe("Arial");
    expect(patch.fontSize).toBe(11);
    expect(patch.lineSpacing).toBe(1);
  });

  it("mendeteksi bagian dokumen dan hanya menghitung bab sekali (bukan dari daftar isi)", async () => {
    const { patch } = await roundTrip(defaultConfig);
    expect(patch.cover).toEqual({ enabled: true });
    expect(patch.sections).toMatchObject({ foreword: true, toc: true, bibliography: true });
    expect(patch.sections?.chapters?.map((c) => c.title)).toEqual(["Pendahuluan", "Pembahasan", "Penutup"]);
  });

  it("mendeteksi bagian yang tidak ada", async () => {
    const { patch } = await roundTrip({
      ...defaultConfig,
      cover: { ...defaultConfig.cover, enabled: false },
      sections: { ...defaultConfig.sections, foreword: false, toc: false, bibliography: false },
    });
    expect(patch.cover).toEqual({ enabled: false });
    expect(patch.sections).toMatchObject({ foreword: false, toc: false, bibliography: false });
    expect(patch.sections?.chapters).toHaveLength(3);
  });

  it("melaporkan apa yang terdeteksi", async () => {
    const { found } = await roundTrip(defaultConfig);
    expect(found.join(" ")).toMatch(/A4/);
    expect(found.join(" ")).toMatch(/Times New Roman/);
  });
});

describe("detectFormat: masukan tidak lazim", () => {
  const sect = (w: number, h: number) =>
    `<w:sectPr><w:pgSz w:w="${w}" w:h="${h}"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>`;

  it("ukuran kertas tak dikenal tidak diubah dan dicatat", () => {
    const r = detectFormat(`<w:document><w:body>${sect(8391, 11906)}</w:body></w:document>`, "");
    expect(r.patch.paper).toBeUndefined();
    expect(r.missing.join(" ")).toMatch(/kertas/i);
    expect(r.patch.margins).toEqual({ top: 2.54, bottom: 2.54, left: 2.54, right: 2.54 });
  });

  it("spasi baris dibulatkan ke pilihan terdekat", () => {
    const styles = `<w:styles><w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
    expect(detectFormat("<w:document/>", styles).patch.lineSpacing).toBe(1);
  });

  it("spasi baris exact diabaikan", () => {
    const styles = `<w:styles><w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:line="360" w:lineRule="exact"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
    const r = detectFormat("<w:document/>", styles);
    expect(r.patch.lineSpacing).toBeUndefined();
  });

  it("gaya Normal menimpa docDefaults", () => {
    const styles = `<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="24"/></w:rPr></w:style></w:styles>`;
    const r = detectFormat("<w:document/>", styles);
    expect(r.patch.font).toBe("Arial");
    expect(r.patch.fontSize).toBe(12);
  });

  it("XML rusak tidak melempar error", () => {
    const r = detectFormat("bukan xml <<<", "juga bukan");
    expect(r.patch).toEqual({});
    expect(r.found).toEqual([]);
  });

  it("bab dengan judul di paragraf berikutnya", () => {
    const p = (t: string) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
    const r = detectFormat(`<w:document><w:body>${p("BAB I")}${p("PENDAHULUAN")}${p("BAB II PEMBAHASAN")}</w:body></w:document>`, "");
    expect(r.patch.sections?.chapters?.map((c) => c.title)).toEqual(["Pendahuluan", "Pembahasan"]);
  });

  it("dokumen tanpa struktur makalah dicatat, dan struktur di form dipertahankan", () => {
    const p = `<w:p><w:r><w:t>Catatan rapat mingguan</w:t></w:r></w:p>`;
    const r = detectFormat(`<w:document><w:body>${p}</w:body></w:document>`, "");
    expect(r.patch.sections).toBeUndefined();
    expect(r.patch.cover).toBeUndefined();
    expect(r.missing.join(" ")).toMatch(/struktur/i);
  });

  it("entitas XML di judul didekode", () => {
    const p = `<w:p><w:r><w:t>BAB I Sains &amp; Teknologi</w:t></w:r></w:p>`;
    const r = detectFormat(`<w:document><w:body>${p}</w:body></w:document>`, "");
    expect(r.patch.sections?.chapters?.[0].title).toBe("Sains & Teknologi");
  });
});

describe("detectFormat: spasi dari paragraf isi dan margin dari seksi dominan", () => {
  const LONG = "Kalimat isi makalah yang cukup panjang untuk dianggap sebagai paragraf isi dan bukan judul atau label. ".repeat(2);
  const para = (line?: number, rule?: string, text = LONG) =>
    `<w:p><w:pPr>${line ? `<w:spacing w:line="${line}"${rule ? ` w:lineRule="${rule}"` : ""}/>` : ""}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const doc = (...ps: string[]) => `<w:document><w:body>${ps.join("")}</w:body></w:document>`;
  const styleLine = (line: number) =>
    `<w:styles><w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;

  it("memakai spasi langsung pada paragraf isi bila gaya tidak menyebutnya", () => {
    const r = detectFormat(doc(para(480, "auto"), para(480, "auto"), para(480, "auto"), para(480, "auto")), "");
    expect(r.patch.lineSpacing).toBe(2);
    expect(r.found.join(" ")).toMatch(/Spasi baris 2/);
  });

  it("spasi langsung paragraf isi menimpa spasi gaya", () => {
    const r = detectFormat(doc(para(480), para(480), para(480), para(480)), styleLine(360));
    expect(r.patch.lineSpacing).toBe(2);
  });

  it("paragraf pendek (judul) tidak dihitung", () => {
    const r = detectFormat(doc(para(480, "auto", "Judul"), para(480, "auto", "Judul lain"), para(480, "auto", "Judul 3"), para(480, "auto", "Judul 4")), styleLine(360));
    expect(r.patch.lineSpacing).toBe(1.5);
  });

  it("bila hanya sedikit paragraf yang berspasi langsung, pakai gaya", () => {
    const r = detectFormat(doc(para(480), para(), para(), para()), styleLine(360));
    expect(r.patch.lineSpacing).toBe(1.5);
  });

  it("spasi tidak ditemukan dicatat", () => {
    const r = detectFormat(doc(para(), para(), para()), "<w:styles/>");
    expect(r.patch.lineSpacing).toBeUndefined();
    expect(r.missing.join(" ")).toMatch(/spasi/i);
  });

  const sect = (top: number) =>
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${top}" w:right="1700" w:bottom="1700" w:left="2268"/></w:sectPr>`;

  it("margin diambil dari seksi yang paling banyak dipakai", () => {
    const r = detectFormat(`<w:document><w:body>${sect(2268)}${sect(2268)}${sect(1701)}</w:body></w:document>`, "");
    expect(r.patch.margins?.top).toBe(4);
  });

  it("bila seri, margin diambil dari seksi terakhir", () => {
    const r = detectFormat(`<w:document><w:body>${sect(1701)}${sect(2268)}</w:body></w:document>`, "");
    expect(r.patch.margins?.top).toBe(4);
  });
});

describe("detectFormat: seksi dominan menurut volume isi", () => {
  const LONG = "Kalimat isi makalah yang panjang. ".repeat(20);
  const pEnd = (text: string, top: number) =>
    `<w:p><w:pPr><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${top}" w:right="1700" w:bottom="1700" w:left="2268"/></w:sectPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const finalSect = (top: number) =>
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${top}" w:right="1700" w:bottom="1700" w:left="2268"/></w:sectPr>`;

  it("memilih seksi dengan teks terbanyak, bukan yang jumlah seksinya terbanyak", () => {
    // tiga seksi pendek bermargin atas 4 cm, satu seksi isi panjang bermargin atas 3 cm
    const doc = `<w:document><w:body>${pEnd("cover", 2268)}${pEnd("daftar", 2268)}${pEnd(LONG, 1701)}${pEnd("pustaka", 2268)}${finalSect(2268)}</w:body></w:document>`;
    expect(detectFormat(doc, "").patch.margins?.top).toBe(3);
  });

  it("seksi terakhir (sectPr tingkat body) ikut dihitung dengan teks sesudah paragraf terakhir yang bersectPr", () => {
    const tail = `<w:p><w:r><w:t>${LONG.repeat(2)}</w:t></w:r></w:p>`;
    const doc = `<w:document><w:body>${pEnd("cover", 1701)}${tail}${finalSect(2268)}</w:body></w:document>`;
    expect(detectFormat(doc, "").patch.margins?.top).toBe(4);
  });
});

describe("readDocxXml", () => {
  it("menolak berkas yang bukan docx", async () => {
    await expect(readDocxXml(new Blob(["bukan zip"]))).rejects.toThrow(/docx/i);
  });

  it("menolak docx tanpa word/document.xml", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("hello.txt", "hi");
    const blob = await zip.generateAsync({ type: "blob" });
    await expect(readDocxXml(blob)).rejects.toThrow(/docx/i);
  });
});
