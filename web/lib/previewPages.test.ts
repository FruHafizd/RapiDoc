import { describe, expect, it } from "vitest";
import { buildPreviewPages } from "./previewPages";
import { defaultConfig, type DocConfig } from "./docConfig";

describe("buildPreviewPages", () => {
  it("urutan halaman dan nomornya sama dengan hasil di Word", () => {
    const pages = buildPreviewPages(defaultConfig);
    expect(pages.map((p) => [p.kind, p.number])).toEqual([
      ["cover", ""],
      ["foreword", "i"],
      ["toc", "ii"],
      ["chapter", "1"],
      ["chapter", "2"],
      ["chapter", "3"],
      ["bibliography", "4"],
    ]);
  });

  it("daftar isi memuat entri dengan nomor halaman dan tingkatnya", () => {
    const toc = buildPreviewPages(defaultConfig).find((p) => p.kind === "toc");
    expect(toc?.kind === "toc" && toc.entries).toEqual([
      { text: "KATA PENGANTAR", level: 1, page: "i" },
      { text: "BAB I PENDAHULUAN", level: 1, page: "1" },
      { text: "A. Latar Belakang", level: 2, page: "1" },
      { text: "B. Rumusan Masalah", level: 2, page: "1" },
      { text: "C. Tujuan Penulisan", level: 2, page: "1" },
      { text: "BAB II PEMBAHASAN", level: 1, page: "2" },
      { text: "BAB III PENUTUP", level: 1, page: "3" },
      { text: "A. Kesimpulan", level: 2, page: "3" },
      { text: "B. Saran", level: 2, page: "3" },
      { text: "DAFTAR PUSTAKA", level: 1, page: "4" },
    ]);
  });

  it("bagian yang dimatikan tidak menjadi halaman dan penomoran menyesuaikan", () => {
    const cfg: DocConfig = {
      ...defaultConfig,
      cover: { ...defaultConfig.cover, enabled: false },
      sections: { ...defaultConfig.sections, foreword: false, bibliography: false },
    };
    const pages = buildPreviewPages(cfg);
    expect(pages.map((p) => [p.kind, p.number])).toEqual([
      ["toc", "i"],
      ["chapter", "1"],
      ["chapter", "2"],
      ["chapter", "3"],
    ]);
  });

  it("tanpa kata pengantar dan daftar isi tidak ada halaman romawi", () => {
    const cfg: DocConfig = {
      ...defaultConfig,
      sections: { ...defaultConfig.sections, foreword: false, toc: false },
    };
    const numbers = buildPreviewPages(cfg).map((p) => p.number);
    expect(numbers).toEqual(["", "1", "2", "3", "4"]);
  });

  it("satu bab saja: daftar pustaka bernomor 2", () => {
    const pages = buildPreviewPages({
      ...defaultConfig,
      sections: { ...defaultConfig.sections, chapters: [{ title: "X", subs: [] }] },
    });
    expect(pages.at(-1)?.number).toBe("2");
  });
});
