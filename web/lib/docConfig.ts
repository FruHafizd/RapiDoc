export type Chapter = { title: string; subs: string[] };

export type Logo = {
  data: Uint8Array;
  type: "png" | "jpg";
  /** Ukuran asli gambar dalam piksel (dipakai untuk menjaga rasio). */
  width: number;
  height: number;
};

export type DocConfig = {
  paper: "A4" | "Letter";
  /** Margin dalam cm. */
  margins: { top: number; bottom: number; left: number; right: number };
  font: string;
  /** Ukuran font dalam pt. */
  fontSize: number;
  lineSpacing: 1 | 1.5 | 2;
  cover: {
    enabled: boolean;
    title: string;
    /** Nama mata kuliah. Kosong = baris "Disusun untuk memenuhi tugas" tidak dicetak. */
    course: string;
    lecturer: string;
    logo?: Logo;
    /** Satu atau lebih penulis (makalah individu atau kelompok). */
    authors: { name: string; idNumber: string }[];
    studyProgram: string;
    faculty: string;
    institution: string;
    year: string;
  };
  sections: {
    foreword: boolean;
    toc: boolean;
    chapters: Chapter[];
    bibliography: boolean;
  };
  withSample: boolean;
};

export const defaultConfig: DocConfig = {
  paper: "A4",
  margins: { top: 3, bottom: 3, left: 4, right: 3 },
  font: "Times New Roman",
  fontSize: 12,
  lineSpacing: 1.5,
  cover: {
    enabled: true,
    title: "Judul Makalah",
    course: "Nama Mata Kuliah",
    lecturer: "Nama Dosen Pengampu, gelar",
    authors: [{ name: "Nama Penulis", idNumber: "NIM" }],
    studyProgram: "Program Studi",
    faculty: "Fakultas",
    institution: "Nama Universitas",
    year: "2026",
  },
  sections: {
    foreword: true,
    toc: true,
    chapters: [
      { title: "Pendahuluan", subs: ["Latar Belakang", "Rumusan Masalah", "Tujuan Penulisan"] },
      { title: "Pembahasan", subs: [] },
      { title: "Penutup", subs: ["Kesimpulan", "Saran"] },
    ],
    bibliography: true,
  },
  withSample: false,
};

export const presets: { id: string; label: string; config: DocConfig }[] = [
  { id: "umum", label: "Umum Indonesia (A4, Times 12, margin 4-3-3-3)", config: defaultConfig },
  {
    id: "apa",
    label: "APA (Letter, Times 12, margin 2,54, spasi 2)",
    config: {
      ...defaultConfig,
      paper: "Letter",
      margins: { top: 2.54, bottom: 2.54, left: 2.54, right: 2.54 },
      lineSpacing: 2,
    },
  },
];

/**
 * Teks bab: satu baris = satu bab; baris berawalan "-" = sub-bab dari bab di atasnya.
 */
export function parseChapters(text: string): Chapter[] {
  const chapters: Chapter[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("-")) {
      const sub = line.replace(/^-+\s*/, "");
      if (sub && chapters.length) chapters[chapters.length - 1].subs.push(sub);
    } else {
      chapters.push({ title: line, subs: [] });
    }
  }
  return chapters;
}

export function chaptersToText(chapters: Chapter[]): string {
  return chapters.flatMap((c) => [c.title, ...c.subs.map((s) => `- ${s}`)]).join("\n");
}
