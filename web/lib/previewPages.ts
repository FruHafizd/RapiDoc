import type { Chapter, DocConfig } from "./docConfig";

export type TocEntry = { text: string; level: 1 | 2; page: string };

export type PreviewPage = { number: string } & (
  | { kind: "cover" }
  | { kind: "foreword" }
  | { kind: "toc"; entries: TocEntry[] }
  | { kind: "chapter"; index: number; chapter: Chapter }
  | { kind: "bibliography" }
);

const ROMAN_UPPER = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export const chapterLabel = (index: number) => `BAB ${ROMAN_UPPER[index] ?? index + 1}`;

const romanLower = (n: number) => (ROMAN_UPPER[n - 1] ?? String(n)).toLowerCase();

/**
 * Daftar halaman seperti struktur .docx: setiap bagian dimulai di halaman baru.
 * Cover tanpa nomor, kata pengantar dan daftar isi bernomor romawi, bab dan
 * daftar pustaka bernomor angka mulai dari 1.
 */
export function buildPreviewPages(config: DocConfig): PreviewPage[] {
  const { cover, sections: sec } = config;
  const pages: PreviewPage[] = [];
  const entries: TocEntry[] = [];

  if (cover.enabled) pages.push({ kind: "cover", number: "" });

  let roman = 0;
  if (sec.foreword) {
    const number = romanLower(++roman);
    pages.push({ kind: "foreword", number });
    entries.push({ text: "KATA PENGANTAR", level: 1, page: number });
  }
  if (sec.toc) {
    pages.push({ kind: "toc", number: romanLower(++roman), entries });
  }

  let arabic = 0;
  sec.chapters.forEach((chapter, index) => {
    const number = String(++arabic);
    pages.push({ kind: "chapter", index, chapter, number });
    entries.push({ text: `${chapterLabel(index)} ${chapter.title.toUpperCase()}`, level: 1, page: number });
    chapter.subs.forEach((sub, j) =>
      entries.push({ text: `${String.fromCharCode(65 + (j % 26))}. ${sub}`, level: 2, page: number }),
    );
  });
  if (sec.bibliography) {
    const number = String(++arabic);
    pages.push({ kind: "bibliography", number });
    entries.push({ text: "DAFTAR PUSTAKA", level: 1, page: number });
  }

  return pages;
}
