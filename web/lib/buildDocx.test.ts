import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildDocx } from "./buildDocx";
import { defaultConfig, type DocConfig } from "./docConfig";

async function unzip(config: DocConfig) {
  const blob = await buildDocx(config);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return {
    doc: await zip.file("word/document.xml")!.async("string"),
    styles: await zip.file("word/styles.xml")!.async("string"),
  };
}

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const logo = {
  data: Uint8Array.from(Buffer.from(PNG_1X1, "base64")),
  type: "png" as const,
  width: 100,
  height: 50,
};

async function unzipFiles(config: DocConfig) {
  const blob = await buildDocx(config);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return { names: Object.keys(zip.files), doc: await zip.file("word/document.xml")!.async("string") };
}

describe("cover akademik", () => {
  it("memuat label makalah, mata kuliah, dosen, prodi, fakultas, institusi, dan tahun", async () => {
    const { doc } = await unzip({
      ...defaultConfig,
      cover: {
        ...defaultConfig.cover,
        course: "Pemrograman Web",
        lecturer: "Dr. Andi, M.Kom.",
        studyProgram: "Teknik Informatika",
        faculty: "Fakultas Teknik",
        institution: "Universitas Contoh",
        year: "2026",
      },
    });
    for (const t of [
      "MAKALAH",
      "Disusun untuk memenuhi tugas mata kuliah Pemrograman Web",
      "Dosen Pengampu:",
      "Dr. Andi, M.Kom.",
      "TEKNIK INFORMATIKA",
      "FAKULTAS TEKNIK",
      "UNIVERSITAS CONTOH",
      "2026",
    ])
      expect(doc).toContain(t);
  });

  it("bidang cover yang kosong tidak dicetak", async () => {
    const { doc } = await unzip({
      ...defaultConfig,
      cover: { ...defaultConfig.cover, course: "", lecturer: "", studyProgram: "", faculty: "" },
    });
    expect(doc).not.toContain("memenuhi tugas");
    expect(doc).not.toContain("Dosen Pengampu");
  });

  it("menyematkan logo bila ada, dan tidak bila tidak ada", async () => {
    const withLogo = await unzipFiles({ ...defaultConfig, cover: { ...defaultConfig.cover, logo } });
    expect(withLogo.names.some((n) => n.startsWith("word/media/"))).toBe(true);
    expect(withLogo.doc).toContain("<w:drawing>");
    const without = await unzipFiles(defaultConfig);
    expect(without.names.some((n) => n.startsWith("word/media/"))).toBe(false);
  });
});

describe("sub-bab dan penutup kata pengantar", () => {
  it("mencetak sub-bab sebagai Heading 2 dan memasukkannya ke daftar isi", async () => {
    const { doc } = await unzip({
      ...defaultConfig,
      sections: {
        ...defaultConfig.sections,
        chapters: [{ title: "Pendahuluan", subs: ["Latar Belakang", "Rumusan Masalah"] }],
      },
    });
    expect(doc).toContain("A. Latar Belakang");
    expect(doc).toContain("B. Rumusan Masalah");
    expect(doc).toContain('w:val="Heading2"');
    expect(doc).toMatch(/TOC \\h \\o &quot;1-2&quot;/);
  });

  it("kata pengantar ditutup dengan tempat/tanggal dan nama penulis", async () => {
    const base = { ...defaultConfig, cover: { ...defaultConfig.cover, enabled: false } };
    const on = await unzip({ ...base, sections: { ...base.sections, foreword: true } });
    expect(on.doc).toContain("[Kota]");
    expect(on.doc).toContain(">Penulis<");
    const off = await unzip({ ...base, sections: { ...base.sections, foreword: false } });
    expect(off.doc).not.toContain("[Kota]");
  });
});

describe("buildDocx", () => {
  it("memakai ukuran kertas dan margin dari konfigurasi", async () => {
    const { doc } = await unzip({
      ...defaultConfig,
      paper: "A4",
      margins: { top: 3, bottom: 3, left: 4, right: 3 },
    });
    expect(doc).toContain('w:w="11906"');
    expect(doc).toContain('w:left="2267"'); // 4 cm (dibulatkan ke bawah)
    expect(doc).toContain('w:top="1700"'); // 3 cm
  });

  it("memakai font, ukuran, dan spasi baris", async () => {
    const { styles } = await unzip({ ...defaultConfig, font: "Arial", fontSize: 11, lineSpacing: 1.5 });
    expect(styles).toContain('w:ascii="Arial"');
    expect(styles).toContain('w:val="22"'); // 11 pt = 22 half-points
    expect(styles).toContain('w:line="360"'); // 1.5 x 240
  });

  it("menyertakan cover, daftar isi, bab, dan halaman romawi", async () => {
    const { doc } = await unzip({
      ...defaultConfig,
      cover: { ...defaultConfig.cover, enabled: true, title: "Judul Uji" },
      sections: { ...defaultConfig.sections, foreword: true, toc: true, bibliography: true },
    });
    expect(doc).toContain("JUDUL UJI");
    expect(doc).toContain("KATA PENGANTAR");
    expect(doc).toContain("DAFTAR ISI");
    expect(doc).toMatch(/TOC \\h \\o/);
    expect(doc).toContain("BAB I");
    expect(doc).toContain("DAFTAR PUSTAKA");
    expect(doc).toContain('w:fmt="lowerRoman"');
    expect(doc).toContain('w:fmt="decimal"');
  });

  it("mencantumkan semua anggota kelompok di cover sesuai urutan", async () => {
    const { doc } = await unzip({
      ...defaultConfig,
      cover: {
        ...defaultConfig.cover,
        authors: [
          { name: "Budi Santoso", idNumber: "1001" },
          { name: "Siti Aminah", idNumber: "1002" },
          { name: "Citra Dewi", idNumber: "1003" },
        ],
      },
    });
    const at = (s: string) => doc.indexOf(s);
    expect(at("Budi Santoso")).toBeGreaterThan(-1);
    expect(at("Siti Aminah")).toBeGreaterThan(at("Budi Santoso"));
    expect(at("Citra Dewi")).toBeGreaterThan(at("Siti Aminah"));
    expect(doc).toContain("1002");
  });

  it("anggota tanpa nama tidak dicetak di cover", async () => {
    const { doc } = await unzip({
      ...defaultConfig,
      cover: { ...defaultConfig.cover, authors: [{ name: "Budi", idNumber: "1" }, { name: " ", idNumber: "9999" }] },
    });
    expect(doc).toContain("Budi");
    expect(doc).not.toContain("9999");
  });

  it("tidak menyertakan bagian yang dimatikan", async () => {
    const { doc } = await unzip({
      ...defaultConfig,
      cover: { ...defaultConfig.cover, enabled: false, title: "Judul Uji" },
      sections: { ...defaultConfig.sections, foreword: false, toc: false, bibliography: false },
    });
    expect(doc).not.toContain("Judul Uji");
    expect(doc).not.toContain("KATA PENGANTAR");
    expect(doc).not.toContain("DAFTAR ISI");
    expect(doc).not.toContain("DAFTAR PUSTAKA");
    expect(doc).not.toContain("lowerRoman");
  });

  it("mode template kosong tidak berisi contoh teks", async () => {
    const empty = await unzip({ ...defaultConfig, withSample: false });
    const sample = await unzip({ ...defaultConfig, withSample: true });
    expect(empty.doc).not.toContain("Lorem");
    expect(sample.doc).toContain("Lorem");
  });
});
