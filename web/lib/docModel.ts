/**
 * Model isi dokumen. Bentuknya sama dengan JSON ProseMirror/TipTap, sehingga
 * bisa langsung dimuat ke editor dan diekspor kembali ke .docx.
 */
export type Align = "left" | "center" | "right" | "justify";
export type MarkType = "bold" | "italic" | "underline";

/** Ukuran huruf dalam pt; hanya dipakai bila berbeda dari ukuran bawaan dokumen. */
export type FontSizeMark = { type: "fontSize"; attrs: { size: number } };
export type Mark = { type: MarkType } | FontSizeMark;

export type TextNode = { type: "text"; text: string; marks?: Mark[] };
export type HardBreak = { type: "hardBreak" };
/** Gambar inline; src berupa data URL (png atau jpeg), ukuran dalam cm. */
export type ImageNode = { type: "image"; attrs: { src: string; widthCm: number; heightCm: number } };
export type Inline = TextNode | HardBreak | ImageNode;

export type TabStop = { pos: number; align: "left" | "center" | "right"; leader?: "dot" | "hyphen" | "underscore" };

export type ParagraphNode = {
  type: "paragraph";
  /**
   * firstLine: indentasi baris pertama (cm). spaceBefore/spaceAfter: jarak antarparagraf (pt).
   * lineSpacing: spasi baris sebagai kelipatan (1, 1.5, 2, ...), menimpa bawaan dokumen.
   */
  attrs?: {
    textAlign?: Align;
    firstLine?: number;
    /** Indentasi kiri (cm). */
    indentLeft?: number;
    /** Indentasi menggantung (cm): baris pertama menjorok keluar, baris lanjutan mengikuti indentLeft. Mis. daftar pustaka. */
    hanging?: number;
    spaceBefore?: number;
    spaceAfter?: number;
    lineSpacing?: number;
    /** Tab stop (cm dari tepi kiri area teks), mis. nomor halaman rata kanan dengan titik-titik. */
    tabs?: TabStop[];
  };
  content?: Inline[];
};
export type HeadingNode = {
  type: "heading";
  attrs: { level: 1 | 2 | 3; textAlign?: Align };
  content?: Inline[];
};
export type ListItemNode = { type: "listItem"; content: ParagraphNode[] };
export type ListNode = { type: "bulletList" | "orderedList"; content: ListItemNode[] };
export type TableCellNode = { type: "tableCell"; attrs?: { colspan?: number }; content: Block[] };
export type TableRowNode = { type: "tableRow"; content: TableCellNode[] };
export type TableNode = { type: "table"; attrs?: { borders?: boolean }; content: TableRowNode[] };
/** Pemisah halaman. */
export type PageBreakNode = { type: "horizontalRule" };

export type Block = ParagraphNode | HeadingNode | ListNode | TableNode | PageBreakNode;
export type DocNode = { type: "doc"; content: Block[] };

/** Ringkasan teks per blok; dipakai pengujian dan ringkasan di UI. */
export function plainText(nodes: Inline[] | undefined): string {
  return (nodes ?? []).map((n) => (n.type === "text" ? n.text : "\n")).join("");
}
