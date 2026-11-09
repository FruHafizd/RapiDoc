import type {
  Align,
  Block,
  DocNode,
  HardBreak,
  HeadingNode,
  ImageNode,
  Inline,
  ListNode,
  Mark,
  PageBreakNode,
  ParagraphNode,
  TabStop,
  TableCellNode,
  TableNode,
  TableRowNode,
  TextNode,
} from "./docModel";
import type { DocxImage, DocxParts } from "./readDocx";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export type ParsedDoc = {
  doc: DocNode;
  /** Jumlah gambar di dokumen asli yang tidak bisa ditampilkan (format tidak didukung, dll.). */
  images: number;
};

type XmlParser = Pick<DOMParser, "parseFromString">;
type StyleDef = { basedOn?: string; pPr?: Element; rPr?: Element };
type Ctx = {
  styles: Map<string, StyleDef>;
  /** Gaya paragraf bawaan (biasanya Normal). */
  defaultParaStyle: string | undefined;
  headingByStyle: Map<string, 1 | 2 | 3>;
  gridTableStyles: Set<string>;
  listTypeByNum: Map<string, ListNode["type"]>;
  /** Ukuran huruf bawaan dokumen (pt), bila ditemukan. */
  defaultSizePt: number | undefined;
  media: Record<string, DocxImage>;
  /** Gambar yang tidak bisa dimuat. */
  skippedImages: number;
};

// ---------- pembantu DOM ----------

const kids = (e: Node | null | undefined, name: string): Element[] => {
  const out: Element[] = [];
  for (let n = e?.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as Element).localName === name) out.push(n as Element);
  }
  return out;
};
const kid = (e: Node | null | undefined, name: string) => kids(e, name)[0];

function attr(e: Element | undefined, name = "val"): string | undefined {
  if (!e) return undefined;
  return e.getAttributeNS(W, name) || e.getAttribute(`w:${name}`) || undefined;
}

/** Elemen sakelar seperti <w:b/>: ada dan tidak bernilai 0/false/off/none. */
function isOn(e: Element | undefined): boolean {
  if (!e) return false;
  const v = attr(e);
  return v === undefined || !["0", "false", "off", "none"].includes(v);
}

function parseXml(parser: XmlParser, xml: string): Document | null {
  if (!xml.trim()) return null;
  try {
    const d = parser.parseFromString(xml, "application/xml");
    if (d.getElementsByTagName("parsererror").length) return null;
    return d;
  } catch {
    return null;
  }
}

// ---------- gaya dan penomoran ----------

function buildContext(stylesDoc: Document | null, numberingDoc: Document | null, media: Record<string, DocxImage>): Ctx {
  const headingByStyle = new Map<string, 1 | 2 | 3>();
  const gridTableStyles = new Set<string>();
  const styles = new Map<string, StyleDef>();
  let defaultParaStyle: string | undefined;
  for (const s of stylesDoc ? Array.from(stylesDoc.getElementsByTagName("*")) : []) {
    if (s.localName !== "style") continue;
    const id = attr(s, "styleId");
    const name = attr(kid(s, "name")) ?? "";
    if (!id) continue;
    styles.set(id, { basedOn: attr(kid(s, "basedOn")), pPr: kid(s, "pPr"), rPr: kid(s, "rPr") });
    if (attr(s, "type") === "paragraph" && attr(s, "default") === "1") defaultParaStyle = id;
    const h = name.match(/^heading\s*(\d)$/i);
    if (h) headingByStyle.set(id, Math.min(3, Math.max(1, Number(h[1]))) as 1 | 2 | 3);
    if (/grid/i.test(name)) gridTableStyles.add(id);
  }

  const listTypeByNum = new Map<string, ListNode["type"]>();
  if (numberingDoc) {
    const fmtByAbstract = new Map<string, string>();
    for (const a of Array.from(numberingDoc.getElementsByTagName("*")).filter((x) => x.localName === "abstractNum")) {
      const lvl = kids(a, "lvl").find((l) => (attr(l, "ilvl") ?? "0") === "0") ?? kids(a, "lvl")[0];
      fmtByAbstract.set(attr(a, "abstractNumId") ?? "", attr(kid(lvl, "numFmt")) ?? "decimal");
    }
    for (const n of Array.from(numberingDoc.getElementsByTagName("*")).filter((x) => x.localName === "num")) {
      const fmt = fmtByAbstract.get(attr(kid(n, "abstractNumId")) ?? "");
      if (fmt !== undefined) listTypeByNum.set(attr(n, "numId") ?? "", fmt === "bullet" ? "bulletList" : "orderedList");
    }
  }
  // Ukuran huruf bawaan: gaya Normal, lalu docDefaults.
  const sizeOfRPr = (rPr: Element | undefined) => {
    const half = Number(attr(kid(rPr, "sz")));
    return Number.isFinite(half) && half > 0 ? half / 2 : undefined;
  };
  const all = stylesDoc ? Array.from(stylesDoc.getElementsByTagName("*")) : [];
  const normal = all.find((e) => e.localName === "style" && attr(e, "styleId") === "Normal");
  const docDefaults = all.find((e) => e.localName === "docDefaults");
  const defaultSizePt =
    sizeOfRPr(kid(normal, "rPr")) ?? sizeOfRPr(kid(kid(docDefaults, "rPrDefault"), "rPr"));

  return { styles, defaultParaStyle, headingByStyle, gridTableStyles, listTypeByNum, defaultSizePt, media, skippedImages: 0 };
}

// ---------- isi paragraf ----------

type Item = { kind: "text"; text: string; marks: Mark[] } | { kind: "br" } | { kind: "pb" } | { kind: "img"; image: ImageNode };

const TRANSPARENT = new Set(["hyperlink", "ins", "smartTag", "fldSimple", "sdt", "sdtContent", "moveTo", "customXml", "bdo", "dir"]);

function collectRuns(node: Node, out: Element[]) {
  for (let n = node.firstChild; n; n = n.nextSibling) {
    if (n.nodeType !== 1) continue;
    const e = n as Element;
    if (e.localName === "r") out.push(e);
    else if (TRANSPARENT.has(e.localName)) collectRuns(e, out);
  }
}

/** Rantai gaya paragraf dari yang paling spesifik ke dasar, termasuk gaya bawaan di ujungnya. */
function styleChain(ctx: Ctx, styleId: string | undefined): StyleDef[] {
  const chain: StyleDef[] = [];
  const seen = new Set<string>();
  let id = styleId ?? ctx.defaultParaStyle;
  while (id && !seen.has(id) && chain.length < 12) {
    seen.add(id);
    const def = ctx.styles.get(id);
    if (!def) break;
    chain.push(def);
    id = def.basedOn;
  }
  const base = ctx.defaultParaStyle ? ctx.styles.get(ctx.defaultParaStyle) : undefined;
  if (base && !chain.includes(base)) chain.push(base);
  return chain;
}

/** Nilai sakelar (b, i, u) dari run, lalu gaya; elemen yang ada menentukan, termasuk saat mematikan. */
function flagOf(rPrs: (Element | undefined)[], name: string): boolean {
  for (const rPr of rPrs) {
    const el = kid(rPr, name);
    if (el) return isOn(el);
  }
  return false;
}

function marksOf(r: Element, ctx: Ctx, chain: StyleDef[]): Mark[] {
  const rPrs = [kid(r, "rPr"), ...chain.map((c) => c.rPr)];
  const marks: Mark[] = [];
  if (flagOf(rPrs, "b")) marks.push({ type: "bold" });
  if (flagOf(rPrs, "i")) marks.push({ type: "italic" });
  if (flagOf(rPrs, "u")) marks.push({ type: "underline" });
  for (const rPr of rPrs) {
    const half = Number(attr(kid(rPr, "sz")));
    if (!Number.isFinite(half) || half <= 0) continue;
    if (half / 2 !== ctx.defaultSizePt) marks.push({ type: "fontSize", attrs: { size: half / 2 } });
    break;
  }
  return marks;
}

const EMU_PER_CM = 360000;

function descendant(node: Node, name: string): Element | undefined {
  for (let n = node.firstChild; n; n = n.nextSibling) {
    if (n.nodeType !== 1) continue;
    const e = n as Element;
    if (e.localName === name) return e;
    const found = descendant(e, name);
    if (found) return found;
  }
  return undefined;
}

function bytesToBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
  return btoa(binary);
}

function readDrawing(drawing: Element, ctx: Ctx): ImageNode | null {
  const blip = descendant(drawing, "blip");
  const rid = blip?.getAttributeNS(REL_NS, "embed") || blip?.getAttribute("r:embed");
  const media = rid ? ctx.media[rid] : undefined;
  if (!media) return null;
  const extent = descendant(drawing, "extent");
  const cx = Number(extent?.getAttribute("cx"));
  const cy = Number(extent?.getAttribute("cy"));
  if (!(cx > 0) || !(cy > 0)) return null;
  const round = (emu: number) => Math.round((emu / EMU_PER_CM) * 100) / 100;
  const mime = media.type === "png" ? "image/png" : "image/jpeg";
  return { type: "image", attrs: { src: `data:${mime};base64,${bytesToBase64(media.data)}`, widthCm: round(cx), heightCm: round(cy) } };
}

function readItems(p: Element, ctx: Ctx, chain: StyleDef[]): Item[] {
  const runs: Element[] = [];
  collectRuns(p, runs);
  const items: Item[] = [];
  for (const r of runs) {
    const marks = marksOf(r, ctx, chain);
    for (let c = r.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const e = c as Element;
      switch (e.localName) {
        case "t":
          items.push({ kind: "text", text: e.textContent ?? "", marks });
          break;
        case "tab":
          items.push({ kind: "text", text: "\t", marks });
          break;
        case "noBreakHyphen":
          items.push({ kind: "text", text: "-", marks });
          break;
        case "br":
          items.push(attr(e, "type") === "page" ? { kind: "pb" } : { kind: "br" });
          break;
        case "cr":
          items.push({ kind: "br" });
          break;
        case "drawing": {
          const image = readDrawing(e, ctx);
          if (image) items.push({ kind: "img", image });
          else ctx.skippedImages++;
          break;
        }
        case "pict":
        case "object":
          ctx.skippedImages++;
          break;
      }
    }
  }
  return items;
}

function toInline(items: Item[]): Inline[] {
  const out: Inline[] = [];
  for (const it of items) {
    if (it.kind === "img") {
      out.push(it.image);
      continue;
    }
    if (it.kind === "br") {
      out.push({ type: "hardBreak" } satisfies HardBreak);
      continue;
    }
    if (it.kind !== "text" || it.text === "") continue;
    const last = out[out.length - 1];
    const key = JSON.stringify(it.marks);
    if (last?.type === "text" && JSON.stringify(last.marks ?? []) === key) {
      last.text += it.text;
    } else {
      const node: TextNode = { type: "text", text: it.text };
      if (it.marks.length) node.marks = it.marks;
      out.push(node);
    }
  }
  return out;
}

/** Atribut paragraf: nilai langsung menimpa gaya (rantai basedOn). */
function pAttr(pPrs: (Element | undefined)[], elName: string, attrName: string): string | undefined {
  for (const pPr of pPrs) {
    const v = attr(kid(pPr, elName), attrName);
    if (v !== undefined) return v;
  }
  return undefined;
}

function alignOf(pPrs: (Element | undefined)[]): Align | undefined {
  const jc = pAttr(pPrs, "jc", "val");
  if (jc === "center") return "center";
  if (jc === "right" || jc === "end") return "right";
  if (jc === "both" || jc === "distribute" || jc === "justify") return "justify";
  return undefined;
}

const cmOf = (twips: number) => Math.round((twips / 567) * 100) / 100;
const num = (v: string | undefined) => (v === undefined ? NaN : Number(v));

type Layout = Pick<NonNullable<ParagraphNode["attrs"]>, "firstLine" | "indentLeft" | "hanging" | "spaceBefore" | "spaceAfter" | "lineSpacing" | "tabs">;

function layoutOf(pPrs: (Element | undefined)[]): Layout {
  const out: Layout = {};
  const hanging = num(pAttr(pPrs, "ind", "hanging"));
  const first = num(pAttr(pPrs, "ind", "firstLine"));
  if (hanging > 0) out.hanging = cmOf(hanging);
  else if (first > 0) out.firstLine = cmOf(first);
  const left = num(pAttr(pPrs, "ind", "left") ?? pAttr(pPrs, "ind", "start"));
  if (left > 0) out.indentLeft = cmOf(left);

  const pt = (v: number) => Math.round((v / 20) * 100) / 100;
  const before = num(pAttr(pPrs, "spacing", "before"));
  const after = num(pAttr(pPrs, "spacing", "after"));
  if (before >= 0) out.spaceBefore = pt(before);
  if (after >= 0) out.spaceAfter = pt(after);
  // Spasi baris dan aturannya harus berasal dari elemen yang sama.
  for (const pPr of pPrs) {
    const sp = kid(pPr, "spacing");
    const line = num(attr(sp, "line"));
    if (!(line > 0)) continue;
    const rule = attr(sp, "lineRule");
    if (!rule || rule === "auto") out.lineSpacing = Math.round((line / 240) * 100) / 100;
    break;
  }

  // Tab stop: gaya dasar dulu, lalu yang lebih spesifik; "clear" menghapus tab dari gaya.
  const stops = new Map<number, TabStop>();
  for (const pPr of [...pPrs].reverse()) {
    for (const tab of kids(kid(pPr, "tabs"), "tab")) {
      const pos = num(attr(tab, "pos"));
      if (!Number.isFinite(pos)) continue;
      const v = attr(tab);
      if (v === "clear") {
        stops.delete(pos);
        continue;
      }
      const leader = attr(tab, "leader");
      stops.set(pos, {
        pos: cmOf(pos),
        align: v === "right" || v === "end" ? "right" : v === "center" ? "center" : "left",
        ...(leader === "dot" || leader === "hyphen" || leader === "underscore" ? { leader } : {}),
      });
    }
  }
  if (stops.size) out.tabs = [...stops.entries()].sort((x, y) => x[0] - y[0]).map(([, t]) => t);
  return out;
}

type ParagraphResult = {
  blocks: (ParagraphNode | HeadingNode | PageBreakNode)[];
  listType?: ListNode["type"];
  breakAfter: boolean;
};

function parseParagraph(p: Element, ctx: Ctx): ParagraphResult {
  const pPr = kid(p, "pPr");
  const styleId = attr(kid(pPr, "pStyle"));
  const level = styleId ? ctx.headingByStyle.get(styleId) : undefined;
  const chain = styleChain(ctx, styleId);
  const pPrs = [pPr, ...chain.map((c) => c.pPr)];
  const textAlign = alignOf(pPrs);

  const numPr = kid(pPr, "numPr");
  const numId = attr(kid(numPr, "numId"));
  const listType = numId && numId !== "0" ? ctx.listTypeByNum.get(numId) : undefined;


  const sect = kid(pPr, "sectPr");
  const breakAfter = !!sect && (attr(kid(sect, "type")) ?? "nextPage") !== "continuous";
  const breakBefore = isOn(kid(pPr, "pageBreakBefore"));

  // Pecah isi paragraf di setiap pemisah halaman.
  const segments: Item[][] = [[]];
  // Judul memakai gaya judul milik editor, jadi tebal/ukuran dari gaya aslinya tidak dibawa.
  for (const it of readItems(p, ctx, level ? [] : chain)) {
    if (it.kind === "pb") segments.push([]);
    else segments[segments.length - 1].push(it);
  }

  const blocks: ParagraphResult["blocks"] = [];
  if (breakBefore) blocks.push({ type: "horizontalRule" });
  segments.forEach((seg, i) => {
    if (i > 0) blocks.push({ type: "horizontalRule" });
    const content = toInline(seg);
    if (level) {
      const attrs: HeadingNode["attrs"] = { level, ...(textAlign ? { textAlign } : {}) };
      blocks.push({ type: "heading", attrs, ...(content.length ? { content } : {}) });
    } else {
      const attrs: NonNullable<ParagraphNode["attrs"]> = {};
      if (textAlign) attrs.textAlign = textAlign;
      if (!listType) Object.assign(attrs, layoutOf(pPrs));
      blocks.push({
        type: "paragraph",
        ...(Object.keys(attrs).length ? { attrs } : {}),
        ...(content.length ? { content } : {}),
      });
    }
  });
  return { blocks, listType: segments.length === 1 && !level && !breakBefore ? listType : undefined, breakAfter };
}

// ---------- blok dan tabel ----------

function parseTable(tbl: Element, ctx: Ctx): TableNode {
  const tblPr = kid(tbl, "tblPr");
  const borders = kid(tblPr, "tblBorders");
  const styleId = attr(kid(tblPr, "tblStyle"));
  // Garis tepi eksplisit pada tabel menimpa gaya; tanpa itu, gaya "grid" yang menentukan.
  const hasBorders = borders
    ? Array.from(borders.childNodes).some((c) => c.nodeType === 1 && !["none", "nil"].includes(attr(c as Element) ?? ""))
    : !!styleId && ctx.gridTableStyles.has(styleId);

  const rows: TableRowNode[] = kids(tbl, "tr").map((tr) => ({
    type: "tableRow",
    content: kids(tr, "tc").map((tc): TableCellNode => {
      const span = Number(attr(kid(kid(tc, "tcPr"), "gridSpan")));
      const content = parseBlocks(tc, ctx).filter((b) => b.type !== "horizontalRule");
      return {
        type: "tableCell",
        ...(span > 1 ? { attrs: { colspan: span } } : {}),
        content: content.length ? content : [{ type: "paragraph" }],
      };
    }),
  }));
  return { type: "table", attrs: { borders: hasBorders }, content: rows.filter((r) => r.content.length) };
}

function parseBlocks(container: Node, ctx: Ctx): Block[] {
  const blocks: Block[] = [];
  let list: ListNode | null = null;

  const visit = (node: Node) => {
    for (let n = node.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 1) continue;
      const e = n as Element;
      if (e.localName === "p") {
        const r = parseParagraph(e, ctx);
        if (r.listType && r.blocks.length === 1 && r.blocks[0].type === "paragraph") {
          const item = { type: "listItem" as const, content: [r.blocks[0]] };
          if (list && list.type === r.listType) list.content.push(item);
          else {
            list = { type: r.listType, content: [item] };
            blocks.push(list);
          }
        } else {
          list = null;
          blocks.push(...r.blocks);
        }
        if (r.breakAfter) {
          list = null;
          blocks.push({ type: "horizontalRule" });
        }
      } else if (e.localName === "tbl") {
        list = null;
        const t = parseTable(e, ctx);
        if (t.content.length) blocks.push(t);
      } else if (e.localName === "sdt") {
        const content = kid(e, "sdtContent");
        if (content) visit(content);
      }
    }
  };
  visit(container);
  return blocks;
}

/**
 * Membaca seluruh isi dokumen (cover, judul, paragraf, daftar, tabel, pemisah halaman)
 * ke model yang bisa dimuat ke editor. Tidak pernah melempar error.
 */
export function docxToDoc(
  parts: Pick<DocxParts, "documentXml" | "stylesXml" | "numberingXml"> & { images?: DocxParts["images"] },
  parser: XmlParser = new DOMParser(),
): ParsedDoc {
  const empty: ParsedDoc = { doc: { type: "doc", content: [] }, images: 0 };
  try {
    const document = parseXml(parser, parts.documentXml);
    const bodyEl = document ? Array.from(document.getElementsByTagName("*")).find((e) => e.localName === "body") : undefined;
    if (!bodyEl) return empty;
    const ctx = buildContext(parseXml(parser, parts.stylesXml), parseXml(parser, parts.numberingXml), parts.images ?? {});
    const content = parseBlocks(bodyEl, ctx);
    return { doc: { type: "doc", content }, images: ctx.skippedImages };
  } catch {
    return empty;
  }
}
