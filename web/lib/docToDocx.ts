import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LeaderType,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  Tab,
  TabStopType,
  WidthType,
  convertMillimetersToTwip,
} from "docx";
import type { Align, Block, DocNode, HeadingNode, ImageNode, Inline, ListNode, ParagraphNode, TableNode } from "./docModel";
import type { DocConfig } from "./docConfig";
import type { PageNumberPosition } from "./detectPageNumbers";

export type ExportFormat = Pick<DocConfig, "paper" | "margins" | "font" | "fontSize" | "lineSpacing"> & {
  pageNumbers: boolean;
  pageNumberPosition: PageNumberPosition;
  /** Halaman pertama (cover) tanpa nomor halaman. */
  skipFirstPage: boolean;
};

const PAPER = {
  A4: { width: 11906, height: 16838 },
  Letter: { width: 12240, height: 15840 },
};

const cm = (v: number) => convertMillimetersToTwip(v * 10);

const ALIGN: Record<Align, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

const HEADING = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const;

type Ctx = { orderedInstances: number; maxImagePx: number };

const PX_PER_CM = 96 / 2.54;
const DATA_URL = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/;

function imageRun(node: ImageNode, maxImagePx: number): ImageRun | null {
  const m = node.attrs.src.match(DATA_URL);
  if (!m || !(node.attrs.widthCm > 0) || !(node.attrs.heightCm > 0)) return null;
  const binary = atob(m[2]);
  const data = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  let width = node.attrs.widthCm * PX_PER_CM;
  let height = node.attrs.heightCm * PX_PER_CM;
  if (width > maxImagePx) {
    height = (height * maxImagePx) / width;
    width = maxImagePx;
  }
  return new ImageRun({
    type: m[1] === "png" ? "png" : "jpg",
    data,
    transformation: { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) },
  });
}

function runs(content: Inline[] | undefined, maxImagePx: number): (TextRun | ImageRun)[] {
  const out: (TextRun | ImageRun)[] = [];
  let breakNext = false;
  for (const node of content ?? []) {
    if (node.type === "hardBreak") {
      breakNext = true;
      continue;
    }
    if (node.type === "image") {
      const img = imageRun(node, maxImagePx);
      if (img) out.push(img);
      continue;
    }
    const fmt = {
      bold: node.marks?.some((m) => m.type === "bold") || undefined,
      italics: node.marks?.some((m) => m.type === "italic") || undefined,
      underline: node.marks?.some((m) => m.type === "underline") ? {} : undefined,
      size: (() => {
        const m = node.marks?.find((x) => x.type === "fontSize");
        return m && m.type === "fontSize" ? Math.round(m.attrs.size * 2) : undefined;
      })(),
    };
    node.text.split(/(\t)/).forEach((part) => {
      if (part === "") return;
      const br = breakNext ? { break: 1 } : {};
      breakNext = false;
      out.push(part === "\t" ? new TextRun({ ...fmt, ...br, children: [new Tab()] }) : new TextRun({ ...fmt, ...br, text: part }));
    });
  }
  return out;
}

function spacingOf(a: ParagraphNode["attrs"]) {
  const out: { before?: number; after?: number; line?: number } = {};
  if (typeof a?.spaceBefore === "number") out.before = Math.round(a.spaceBefore * 20);
  if (typeof a?.spaceAfter === "number") out.after = Math.round(a.spaceAfter * 20);
  if (typeof a?.lineSpacing === "number") out.line = Math.round(a.lineSpacing * 240);
  return Object.keys(out).length ? out : undefined;
}

function paragraph(node: ParagraphNode, maxImagePx: number, opts: { pageBreakBefore?: boolean; numbering?: { reference: string; instance?: number } } = {}) {
  const a = node.attrs;
  return new Paragraph({
    alignment: a?.textAlign ? ALIGN[a.textAlign] : undefined,
    indent:
      a?.firstLine || a?.indentLeft || a?.hanging
        ? {
            left: a.indentLeft ? cm(a.indentLeft) : undefined,
            hanging: a.hanging ? cm(a.hanging) : undefined,
            firstLine: !a.hanging && a.firstLine ? cm(a.firstLine) : undefined,
          }
        : undefined,
    tabStops: a?.tabs?.length
      ? a.tabs.map((t) => ({
          type: t.align === "right" ? TabStopType.RIGHT : t.align === "center" ? TabStopType.CENTER : TabStopType.LEFT,
          position: cm(t.pos),
          leader: t.leader === "dot" ? LeaderType.DOT : t.leader === "hyphen" ? LeaderType.HYPHEN : t.leader === "underscore" ? LeaderType.UNDERSCORE : undefined,
        }))
      : undefined,
    spacing: spacingOf(a),
    pageBreakBefore: opts.pageBreakBefore || undefined,
    numbering: opts.numbering ? { ...opts.numbering, level: 0 } : undefined,
    children: runs(node.content, maxImagePx),
  });
}

function heading(node: HeadingNode, maxImagePx: number, pageBreakBefore?: boolean) {
  return new Paragraph({
    heading: HEADING[node.attrs.level],
    alignment: node.attrs.textAlign ? ALIGN[node.attrs.textAlign] : undefined,
    pageBreakBefore: pageBreakBefore || undefined,
    children: runs(node.content, maxImagePx),
  });
}

function list(node: ListNode, ctx: Ctx): Paragraph[] {
  const numbering =
    node.type === "bulletList" ? { reference: "bullets" } : { reference: "numbers", instance: ctx.orderedInstances++ };
  return node.content.flatMap((item) => item.content.map((p) => paragraph(p, ctx.maxImagePx, { numbering })));
}

function table(node: TableNode, textWidth: number, maxImagePx: number): Table {
  const none = { style: BorderStyle.NONE, size: 0, color: "auto" };
  const line = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const b = node.attrs?.borders ? line : none;
  const columns = Math.max(1, ...node.content.map((r) => r.content.reduce((n, c) => n + (c.attrs?.colspan ?? 1), 0)));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: Array.from({ length: columns }, () => Math.floor(textWidth / columns)),
    borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b },
    rows: node.content.map(
      (row) =>
        new TableRow({
          children: row.content.map(
            (cell) =>
              new TableCell({
                columnSpan: cell.attrs?.colspan && cell.attrs.colspan > 1 ? cell.attrs.colspan : undefined,
                children: blocks(cell.content, textWidth, { orderedInstances: 0, maxImagePx: Math.max(1, maxImagePx / columns) }, true),
              }),
          ),
        }),
    ),
  });
}

function blocks(content: Block[], textWidth: number, ctx: Ctx, inCell = false): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  let pendingBreak = false;
  for (const b of content) {
    if (b.type === "horizontalRule") {
      if (!inCell) pendingBreak = true;
      continue;
    }
    if (b.type === "paragraph") out.push(paragraph(b, ctx.maxImagePx, { pageBreakBefore: pendingBreak }));
    else if (b.type === "heading") out.push(heading(b, ctx.maxImagePx, pendingBreak));
    else {
      // Daftar dan tabel tidak membawa penanda halaman baru sendiri.
      if (pendingBreak) out.push(new Paragraph({ pageBreakBefore: true }));
      if (b.type === "table") out.push(table(b, textWidth, ctx.maxImagePx));
      else out.push(...list(b, ctx));
    }
    pendingBreak = false;
  }
  if (pendingBreak) out.push(new Paragraph({ pageBreakBefore: true }));
  // Word membutuhkan paragraf setelah tabel, termasuk di akhir sel dan dokumen.
  if (out.length === 0 || out[out.length - 1] instanceof Table) out.push(new Paragraph({}));
  return out;
}

export async function docToDocx(doc: DocNode, format: ExportFormat): Promise<Blob> {
  const size = PAPER[format.paper];
  const margin = {
    top: cm(format.margins.top),
    bottom: cm(format.margins.bottom),
    left: cm(format.margins.left),
    right: cm(format.margins.right),
  };
  const textWidth = size.width - margin.left - margin.right;
  const lineSpacing = 240 * format.lineSpacing;

  const headingStyle = (id: string, name: string) => ({
    id,
    name,
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    run: { font: format.font, size: format.fontSize * 2, bold: true, color: "000000" },
    paragraph: { spacing: { before: 120, after: 120, line: lineSpacing } },
  });

  const listLevel = (fmt: (typeof LevelFormat)[keyof typeof LevelFormat], text: string) => ({
    level: 0,
    format: fmt,
    text,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720, hanging: 360 } } },
  });

  const skipFirst = format.pageNumbers && format.skipFirstPage;
  const numberParagraph = () =>
    new Paragraph({
      alignment: format.pageNumberPosition === "bottom-center" ? AlignmentType.CENTER : AlignmentType.RIGHT,
      children: [new TextRun({ children: [PageNumber.CURRENT] })],
    });
  const onTop = format.pageNumberPosition === "top-right";
  const pageNumberParts = format.pageNumbers
    ? {
        default: onTop ? new Header({ children: [numberParagraph()] }) : new Footer({ children: [numberParagraph()] }),
        ...(skipFirst ? { first: onTop ? new Header({ children: [new Paragraph({})] }) : new Footer({ children: [new Paragraph({})] }) } : {}),
      }
    : undefined;

  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: format.font, size: format.fontSize * 2 },
          paragraph: { spacing: { line: lineSpacing } },
        },
      },
      paragraphStyles: [headingStyle("Heading1", "Heading 1"), headingStyle("Heading2", "Heading 2"), headingStyle("Heading3", "Heading 3")],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [listLevel(LevelFormat.BULLET, "•")] },
        { reference: "numbers", levels: [listLevel(LevelFormat.DECIMAL, "%1.")] },
      ],
    },
    sections: [
      {
        properties: { page: { size, margin }, titlePage: skipFirst || undefined },
        ...(onTop ? { headers: pageNumberParts } : { footers: pageNumberParts }),
        children: blocks(doc.content, textWidth, { orderedInstances: 0, maxImagePx: textWidth / 15 }),
      },
    ],
  });
  return Packer.toBlob(document);
}
