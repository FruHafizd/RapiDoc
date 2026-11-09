import { describe, expect, it } from "vitest";
import { chaptersToText, parseChapters } from "./docConfig";

describe("parseChapters", () => {
  it("mengelompokkan baris berawalan - sebagai sub-bab dari bab di atasnya", () => {
    expect(parseChapters("Pendahuluan\n- Latar Belakang\n-Tujuan\nPenutup")).toEqual([
      { title: "Pendahuluan", subs: ["Latar Belakang", "Tujuan"] },
      { title: "Penutup", subs: [] },
    ]);
  });

  it("mengabaikan baris kosong dan sub-bab tanpa bab", () => {
    expect(parseChapters("\n- Yatim\n\nBab A\n")).toEqual([{ title: "Bab A", subs: [] }]);
  });

  it("bolak-balik teks tidak mengubah isi", () => {
    const chapters = [{ title: "A", subs: ["x", "y"] }, { title: "B", subs: [] }];
    expect(parseChapters(chaptersToText(chapters))).toEqual(chapters);
  });
});
