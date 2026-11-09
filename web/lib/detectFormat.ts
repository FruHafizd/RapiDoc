import type { Chapter, DocConfig } from "./docConfig";

export type DetectedPatch = Partial<Pick<DocConfig, "paper" | "margins" | "font" | "fontSize" | "lineSpacing">> & {
  cover?: { enabled: boolean };
  sections?: Partial<DocConfig["sections"]>;
};

export type Detection = {
  patch: DetectedPatch;
  /** Hal yang berhasil dikenali, untuk ditampilkan ke pengguna. */
  found: string[];
  /** Hal yang tidak dikenali; nilai di form dipertahankan. */
  missing: string[];
};

const PAPERS = {
  A4: [11906, 16838],
  Letter: [12240, 15840],
} as const;
const PAPER_TOLERANCE = 30; // twip
const SPACINGS = [1, 1.5, 2] as const;

const attr = (tag: string | undefined, name: string) => tag?.match(new RegExp(`w:${name}="([^"]*)"`))?.[1];
const num = (v: string | undefined) => (v === undefined || v === "" ? NaN : Number(v));
const twipToCm = (tw: number) => Math.round(((tw * 2.54) / 1440) * 100) / 100;
const fmt = (n: number) => String(n).replace(".", ",");

function decode(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());

function dominantSection(documentXml: string): string | undefined {
  const matches = [...documentXml.matchAll(/<w:sectPr[\s>][\s\S]*?<\/w:sectPr>/g)];
  if (!matches.length) return undefined;
  const key = (x: string) => `${x.match(/<w:pgSz\b[^>]*>/)?.[0]}|${x.match(/<w:pgMar\b[^>]*>/)?.[0]}`;

  // Bobot tiap pengaturan halaman = jumlah karakter teks pada seksi yang memakainya
  // (teks sebelum sectPr hingga sectPr sebelumnya). Jika tidak ada teks, hitung jumlah seksi.
  const weight = new Map<string, number>();
  const count = new Map<string, number>();
  let from = 0;
  for (const m of matches) {
    const start = m.index ?? 0;
    let end = start + m[0].length;
    // sectPr di dalam pPr berada di paragraf terakhir seksi; teks paragraf itu ikut seksi ini.
    if (documentXml.lastIndexOf("<w:pPr>", start) > documentXml.lastIndexOf("</w:pPr>", start)) {
      const close = documentXml.indexOf("</w:p>", end);
      if (close >= 0) end = close;
    }
    const segment = documentXml.slice(from, start) + documentXml.slice(start + m[0].length, end);
    from = end;
    const chars = [...segment.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].reduce((n, t) => n + t[1].length, 0);
    const k = key(m[0]);
    weight.set(k, (weight.get(k) ?? 0) + chars);
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const score = (k: string) => (weight.get(k) ?? 0) * 1000 + (count.get(k) ?? 0);
  const best = Math.max(...[...weight.keys()].map(score));
  // Jika seri, ambil seksi terakhir.
  return [...matches].reverse().map((m) => m[0]).find((x) => score(key(x)) === best);
}

function detectPage(documentXml: string, patch: DetectedPatch, found: string[], missing: string[]) {
  const sect = dominantSection(documentXml);
  if (!sect) return;

  const pgSz = sect.match(/<w:pgSz\b[^>]*>/)?.[0];
  const w = num(attr(pgSz, "w"));
  const h = num(attr(pgSz, "h"));
  if (Number.isFinite(w) && Number.isFinite(h)) {
    const [short, long] = [Math.min(w, h), Math.max(w, h)];
    const paper = (Object.keys(PAPERS) as (keyof typeof PAPERS)[]).find(
      (k) => Math.abs(PAPERS[k][0] - short) <= PAPER_TOLERANCE && Math.abs(PAPERS[k][1] - long) <= PAPER_TOLERANCE,
    );
    if (paper) {
      patch.paper = paper;
      found.push(`Kertas ${paper}`);
    } else {
      missing.push("Ukuran kertas tidak dikenali (hanya A4 dan Letter), pilihan di form dipertahankan");
    }
  }

  const pgMar = sect.match(/<w:pgMar\b[^>]*>/)?.[0];
  const m = (["top", "bottom", "left", "right"] as const).map((k) => num(attr(pgMar, k)));
  if (m.every(Number.isFinite)) {
    const [top, bottom, left, right] = m.map(twipToCm);
    patch.margins = { top, bottom, left, right };
    found.push(`Margin atas ${fmt(top)}, bawah ${fmt(bottom)}, kiri ${fmt(left)}, kanan ${fmt(right)} cm`);
  }
}

function detectTypography(stylesXml: string, patch: DetectedPatch, found: string[], missing: string[]) {
  if (!stylesXml.includes("<w:style") && !stylesXml.includes("<w:docDefaults")) return;
  const normal = stylesXml.match(/<w:style\b[^>]*w:styleId="Normal"[^>]*>[\s\S]*?<\/w:style>/)?.[0] ?? "";
  const defaults = stylesXml.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)?.[0] ?? "";
  const blocks = [normal, defaults];

  for (const b of blocks) {
    const fonts = b.match(/<w:rFonts\b[^>]*>/)?.[0];
    const name = attr(fonts, "ascii") ?? attr(fonts, "hAnsi");
    if (name) {
      patch.font = name;
      break;
    }
  }
  for (const b of blocks) {
    const half = num(b.match(/<w:sz\s+w:val="(\d+)"/)?.[1]);
    if (Number.isFinite(half)) {
      patch.fontSize = half / 2;
      break;
    }
  }
  if (patch.font && patch.fontSize) found.push(`Font ${patch.font} ${fmt(patch.fontSize)} pt`);
  else if (patch.font) found.push(`Font ${patch.font}`);
  else if (patch.fontSize) found.push(`Ukuran font ${fmt(patch.fontSize)} pt`);
  if (!patch.font) missing.push("Jenis font tidak ditemukan (mungkin memakai font tema), pilihan di form dipertahankan");
}

const MIN_BODY_PARAGRAPHS = 3;
const LONG_PARAGRAPH = 80; // karakter; di bawah ini dianggap judul atau label

const snapSpacing = (ratio: number) =>
  SPACINGS.reduce((best, s) => (Math.abs(s - ratio) < Math.abs(best - ratio) ? s : best));

/** Spasi yang dipakai mayoritas paragraf isi lewat format langsung (bukan dari gaya). */
function bodySpacing(documentXml: string): number | undefined {
  const values: (number | undefined)[] = [];
  for (const p of documentXml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? []) {
    if (/w:pStyle w:val="TOC/i.test(p) || p.includes("PAGEREF")) continue;
    const text = [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
    if (text.length < LONG_PARAGRAPH) continue;
    const pPr = p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
    const spacing = [...pPr.matchAll(/<w:spacing\b[^>]*>/g)].map((m) => m[0]).find((t) => attr(t, "line"));
    const rule = attr(spacing, "lineRule");
    const line = num(attr(spacing, "line"));
    values.push(spacing && (!rule || rule === "auto") && Number.isFinite(line) ? snapSpacing(line / 240) : undefined);
  }
  if (values.length < MIN_BODY_PARAGRAPHS) return undefined;
  const counts = new Map<number, number>();
  for (const v of values) if (v !== undefined) counts.set(v, (counts.get(v) ?? 0) + 1);
  const [mode, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return mode !== undefined && count * 2 >= values.length ? mode : undefined;
}

function styleSpacing(stylesXml: string, missing: string[]): number | undefined {
  const normal = stylesXml.match(/<w:style\b[^>]*w:styleId="Normal"[^>]*>[\s\S]*?<\/w:style>/)?.[0] ?? "";
  const defaults = stylesXml.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)?.[0] ?? "";
  for (const b of [normal, defaults]) {
    const spacing = b.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0]?.match(/<w:spacing\b[^>]*>/)?.[0];
    const line = num(attr(spacing, "line"));
    if (!Number.isFinite(line)) continue;
    const rule = attr(spacing, "lineRule");
    if (rule && rule !== "auto") {
      missing.push("Spasi baris bernilai tetap (bukan kelipatan), pilihan di form dipertahankan");
      return undefined;
    }
    return snapSpacing(line / 240);
  }
  return undefined;
}

function detectSpacing(documentXml: string, stylesXml: string, patch: DetectedPatch, found: string[], missing: string[]) {
  const fromBody = bodySpacing(documentXml);
  const fixedNotes: string[] = [];
  const spacing = fromBody ?? styleSpacing(stylesXml, fixedNotes);
  if (spacing !== undefined) {
    patch.lineSpacing = spacing as DocConfig["lineSpacing"];
    found.push(`Spasi baris ${fmt(spacing)}${fromBody !== undefined ? " (dari paragraf isi)" : ""}`);
    return;
  }
  missing.push(...fixedNotes);
  if (fixedNotes.length === 0 && /<w:p[\s>]/.test(documentXml)) {
    missing.push("Spasi baris tidak ditemukan, pilihan di form dipertahankan");
  }
}

type Para = { lines: string[]; skip: boolean };

function readParagraphs(documentXml: string): Para[] {
  const paras = documentXml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? [];
  return paras.map((p) => {
    let text = "";
    for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:br\s*\/>|<w:tab\s*\/>/g)) {
      text += m[1] !== undefined ? decode(m[1]) : m[0].startsWith("<w:br") ? "\n" : " ";
    }
    // Entri daftar isi tidak boleh dihitung sebagai bab.
    const skip = /w:pStyle w:val="TOC/i.test(p) || p.includes("PAGEREF");
    return { lines: text.split("\n").map((l) => l.trim()).filter(Boolean), skip };
  });
}

const BAB = /^BAB\s+(?:[IVXLCDM]+|\d+)\b[\s.:\-–]*(.*)$/i;
const upper = (p: Para) => p.lines.join(" ").toUpperCase();

function detectStructure(documentXml: string, patch: DetectedPatch, found: string[], missing: string[]) {
  const paras = readParagraphs(documentXml).filter((p) => p.lines.length > 0);
  const body = paras.filter((p) => !p.skip);

  const chapters: Chapter[] = [];
  const chapterAt: number[] = [];
  body.forEach((p, i) => {
    const m = p.lines[0].match(BAB);
    if (!m) return;
    let title = m[1].trim() || p.lines[1] || "";
    if (!title) {
      const next = body[i + 1];
      if (next && !BAB.test(next.lines[0]) && next.lines[0].length <= 100) title = next.lines[0];
    }
    chapters.push({ title: titleCase(title), subs: [] });
    chapterAt.push(i);
  });

  const idx = (re: RegExp) => body.findIndex((p) => re.test(upper(p)) && upper(p).length <= 30);
  const foreword = idx(/^KATA PENGANTAR$/);
  const tocHeading = idx(/^DAFTAR ISI$/);
  const bibliography = idx(/^(DAFTAR PUSTAKA|DAFTAR REFERENSI|REFERENCES)$/);
  const hasTocField = /<w:instrText[^>]*>\s*TOC\b/.test(documentXml);

  const markers = [foreword, tocHeading, bibliography, chapterAt[0] ?? -1].filter((i) => i >= 0);
  if (markers.length === 0) {
    if (body.length > 0) {
      missing.push("Struktur makalah (cover, kata pengantar, bab, daftar pustaka) tidak dikenali, pilihan di form dipertahankan");
    }
    return;
  }

  const firstMarker = Math.min(...markers);
  patch.cover = { enabled: firstMarker > 0 };
  patch.sections = {
    foreword: foreword >= 0,
    toc: tocHeading >= 0 || hasTocField,
    bibliography: bibliography >= 0,
    ...(chapters.length ? { chapters } : {}),
  };

  if (patch.cover.enabled) found.push("Cover");
  else missing.push("Cover tidak ditemukan");
  if (foreword >= 0) found.push("Kata pengantar");
  else missing.push("Kata pengantar tidak ditemukan");
  if (patch.sections.toc) found.push("Daftar isi");
  else missing.push("Daftar isi tidak ditemukan");
  if (chapters.length) found.push(`${chapters.length} bab`);
  else missing.push("Judul bab (BAB I, BAB II, ...) tidak ditemukan");
  if (bibliography >= 0) found.push("Daftar pustaka");
  else missing.push("Daftar pustaka tidak ditemukan");
}

const MAX_CHAPTERS = 30;
const MAX_SUBS = 20;
const MAX_TEXT = 120;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const inRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const bool = (v: unknown): v is boolean => typeof v === "boolean";

/**
 * Hanya meloloskan nilai yang bentuk dan rentangnya wajar. Dokumen yang diunggah
 * tidak dipercaya, dan data dari penyimpanan peramban diperlakukan sama.
 */
export function sanitizePatch(input: unknown): DetectedPatch {
  if (!isObj(input)) return {};
  const out: DetectedPatch = {};

  if (input.paper === "A4" || input.paper === "Letter") out.paper = input.paper;

  const m = input.margins;
  if (isObj(m) && ([m.top, m.bottom, m.left, m.right] as unknown[]).every((v) => inRange(v, 0, 10))) {
    out.margins = { top: m.top as number, bottom: m.bottom as number, left: m.left as number, right: m.right as number };
  }

  if (typeof input.font === "string" && input.font.trim() && input.font.length <= 64) out.font = input.font;
  if (inRange(input.fontSize, 6, 72)) out.fontSize = input.fontSize;
  if (input.lineSpacing === 1 || input.lineSpacing === 1.5 || input.lineSpacing === 2) out.lineSpacing = input.lineSpacing;

  if (isObj(input.cover) && bool(input.cover.enabled)) out.cover = { enabled: input.cover.enabled };

  if (isObj(input.sections)) {
    const s = input.sections;
    const sections: NonNullable<DetectedPatch["sections"]> = {};
    if (bool(s.foreword)) sections.foreword = s.foreword;
    if (bool(s.toc)) sections.toc = s.toc;
    if (bool(s.bibliography)) sections.bibliography = s.bibliography;
    if (Array.isArray(s.chapters)) {
      const chapters: Chapter[] = [];
      for (const c of s.chapters) {
        if (!isObj(c) || typeof c.title !== "string" || !c.title.trim()) continue;
        const subs = Array.isArray(c.subs)
          ? c.subs.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, MAX_SUBS)
          : [];
        chapters.push({ title: c.title.trim().slice(0, MAX_TEXT), subs: subs.map((x) => x.trim().slice(0, MAX_TEXT)) });
        if (chapters.length === MAX_CHAPTERS) break;
      }
      if (chapters.length) sections.chapters = chapters;
    }
    if (Object.keys(sections).length) out.sections = sections;
  }
  return out;
}

/**
 * Memperkirakan format makalah dari XML .docx. Hasilnya berupa tebakan, bukan jaminan:
 * pengguna tetap bisa mengoreksi di form. Fungsi ini tidak pernah melempar error.
 */
export function detectFormat(documentXml: string, stylesXml: string): Detection {
  const patch: DetectedPatch = {};
  const found: string[] = [];
  const missing: string[] = [];
  try {
    detectPage(documentXml, patch, found, missing);
    detectTypography(stylesXml, patch, found, missing);
    detectSpacing(documentXml, stylesXml, patch, found, missing);
    detectStructure(documentXml, patch, found, missing);
  } catch {
    return { patch: {}, found: [], missing: ["Dokumen tidak dapat dianalisis"] };
  }
  return { patch: sanitizePatch(patch), found, missing };
}
