import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  NumberFormat,
  PageNumber,
  Packer,
  Paragraph,
  TableOfContents,
  TextRun,
  convertMillimetersToTwip,
} from "docx";
import type { DocConfig } from "./docConfig";

const PAPER = {
  A4: { width: 11906, height: 16838 },
  Letter: { width: 12240, height: 15840 },
};

const SAMPLE =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const LOGO_WIDTH_PX = 150; // sekitar 4 cm

const cm = (v: number) => convertMillimetersToTwip(v * 10);
const filled = (v: string) => v.trim().length > 0;

const centered = (text: string, bold = false, before = 0) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before, after: 240 },
    children: [new TextRun({ text, bold })],
  });

const body = (text: string) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: cm(1.25) },
    children: [new TextRun(text)],
  });

const heading = (...lines: string[]) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    pageBreakBefore: true,
    children: lines.map((text, i) => new TextRun({ text, break: i ? 1 : 0 })),
  });

const subheading = (text: string) =>
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });

const pageNumberFooter = () =>
  new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT] })],
      }),
    ],
  });

function coverChildren(cover: DocConfig["cover"]): Paragraph[] {
  const authors = cover.authors.filter((a) => filled(a.name));
  const institutionLines = [cover.studyProgram, cover.faculty, cover.institution]
    .filter(filled)
    .map((t) => t.trim().toUpperCase());

  const out: Paragraph[] = [centered("MAKALAH", true)];
  if (filled(cover.course)) {
    out.push(centered(`Disusun untuk memenuhi tugas mata kuliah ${cover.course.trim()}`));
  }
  out.push(centered(cover.title.toUpperCase(), true, 480));

  if (cover.logo) {
    const { data, type, width, height } = cover.logo;
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 480 },
        children: [
          new ImageRun({
            type,
            data,
            transformation: { width: LOGO_WIDTH_PX, height: Math.round((LOGO_WIDTH_PX * height) / width) },
          }),
        ],
      }),
    );
  }

  if (filled(cover.lecturer)) {
    out.push(centered("Dosen Pengampu:", false, 480), centered(cover.lecturer.trim(), true));
  }

  out.push(centered(authors.length > 1 ? "Disusun oleh kelompok:" : "Disusun oleh:", false, 480));
  for (const a of authors) {
    out.push(centered(filled(a.idNumber) ? `${a.name.trim()} (${a.idNumber.trim()})` : a.name.trim(), true));
  }

  institutionLines.forEach((t, i) => out.push(centered(t, true, i === 0 ? 720 : 0)));
  if (filled(cover.year)) out.push(centered(cover.year.trim()));
  return out;
}

export async function buildDocx(config: DocConfig): Promise<Blob> {
  const { cover, sections: sec, withSample } = config;
  const size = PAPER[config.paper];
  const margin = {
    top: cm(config.margins.top),
    bottom: cm(config.margins.bottom),
    left: cm(config.margins.left),
    right: cm(config.margins.right),
  };
  const page = { size, margin };

  const result = [];

  if (cover.enabled) {
    result.push({ properties: { page }, children: coverChildren(cover) });
  }

  if (sec.foreword || sec.toc) {
    const children: Paragraph[] = [];
    if (sec.foreword) {
      children.push(heading("KATA PENGANTAR"));
      if (withSample) children.push(body(SAMPLE));
      children.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 480 },
          children: [new TextRun("[Kota], [tanggal] [bulan] [tahun]")],
        }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun("Penulis")] }),
      );
    }
    if (sec.toc) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          pageBreakBefore: true,
          spacing: { after: 240 },
          children: [new TextRun({ text: "DAFTAR ISI", bold: true })],
        }),
      );
    }
    result.push({
      properties: {
        page: { ...page, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } },
      },
      footers: { default: pageNumberFooter() },
      children: sec.toc
        ? [...children, new TableOfContents("Daftar Isi", { hyperlink: true, headingStyleRange: "1-2" })]
        : children,
    });
  }

  const blocks: Paragraph[] = [];
  sec.chapters.forEach((ch, i) => {
    blocks.push(heading(`BAB ${ROMAN[i] ?? i + 1}`, ch.title.toUpperCase()));
    if (!ch.subs.length && withSample) blocks.push(body(SAMPLE));
    ch.subs.forEach((s, j) => {
      blocks.push(subheading(`${String.fromCharCode(65 + (j % 26))}. ${s}`));
      if (withSample) blocks.push(body(SAMPLE));
    });
  });
  if (sec.bibliography) {
    blocks.push(heading("DAFTAR PUSTAKA"));
    if (withSample) blocks.push(body(SAMPLE));
  }

  result.push({
    properties: { page: { ...page, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
    footers: { default: pageNumberFooter() },
    children: blocks,
  });

  const headingBase = {
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    paragraph: { spacing: { after: 240, line: 240 * config.lineSpacing } },
  };

  const doc = new Document({
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: { font: config.font, size: config.fontSize * 2 },
          paragraph: { spacing: { line: 240 * config.lineSpacing } },
        },
      },
      paragraphStyles: [
        {
          ...headingBase,
          id: "Heading1",
          name: "Heading 1",
          run: { font: config.font, size: config.fontSize * 2, bold: true, color: "000000" },
        },
        {
          ...headingBase,
          id: "Heading2",
          name: "Heading 2",
          run: { font: config.font, size: config.fontSize * 2, bold: true, color: "000000" },
          paragraph: { spacing: { before: 120, after: 120, line: 240 * config.lineSpacing } },
        },
      ],
    },
    sections: result,
  });

  return Packer.toBlob(doc);
}
