"use client";

import { Extension, Mark } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMemo, type CSSProperties } from "react";
import type { DocNode } from "@/lib/docModel";
import type { ExportFormat } from "@/lib/docToDocx";

const PAPER_CM = { A4: 21, Letter: 21.59 };

const PT = "calc(var(--cm) * 0.035278 *";

/** Tata letak paragraf: indentasi baris pertama (cm), jarak sebelum/sesudah (pt), dan spasi baris. */
const ParagraphLayout = Extension.create({
  name: "paragraphLayout",
  addGlobalAttributes() {
    const style = (css: string) => ({ style: css });
    return [
      {
        types: ["paragraph"],
        attributes: {
          indentLeft: { default: null, renderHTML: (a) => (a.indentLeft ? style(`margin-left: calc(var(--cm) * ${a.indentLeft})`) : {}) },
          hanging: { default: null, renderHTML: (a) => (a.hanging ? style(`text-indent: calc(var(--cm) * -${a.hanging})`) : {}) },
          firstLine: { default: null, renderHTML: (a) => (a.firstLine ? style(`text-indent: ${a.firstLine}cm`) : {}) },
          spaceBefore: { default: null, renderHTML: (a) => (typeof a.spaceBefore === "number" ? style(`margin-top: ${PT} ${a.spaceBefore})`) : {}) },
          spaceAfter: { default: null, renderHTML: (a) => (typeof a.spaceAfter === "number" ? style(`margin-bottom: ${PT} ${a.spaceAfter})`) : {}) },
          tabs: { default: null, renderHTML: () => ({}) },
          lineSpacing: { default: null, renderHTML: (a) => (a.lineSpacing ? style(`line-height: ${a.lineSpacing * 1.15}`) : {}) },
        },
      },
    ];
  },
});

/** Ukuran huruf per teks (pt), untuk judul cover dan semacamnya. */
const FontSize = Mark.create({
  name: "fontSize",
  addAttributes() {
    return {
      size: {
        default: null,
        renderHTML: (a) => (a.size ? { "data-font-size": a.size, style: `font-size: ${PT} ${a.size})` } : {}),
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
});

/** Gambar inline dengan ukuran dalam cm (skala mengikuti lebar halaman). */
const SizedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      widthCm: { default: null, renderHTML: (a) => (a.widthCm ? { style: `width: calc(var(--cm) * ${a.widthCm}); height: auto; max-width: 100%` } : {}) },
      heightCm: { default: null },
    };
  },
}).configure({ inline: true, allowBase64: true });

const BorderedTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      borders: {
        default: true,
        renderHTML: (attrs) => ({ "data-borders": String(attrs.borders !== false) }),
      },
    };
  },
});

export function getDocJson(editor: Editor): DocNode {
  return editor.getJSON() as unknown as DocNode;
}

function Btn({ label, active, onClick, disabled, title }: { label: string; active?: boolean; onClick: () => void; disabled?: boolean; title: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded border px-2 py-1 text-sm disabled:opacity-40 ${active ? "border-accent bg-accent text-accent-ink" : "border-line bg-white hover:bg-paper"}`}
    >
      {label}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      left: e.isActive({ textAlign: "left" }),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      justify: e.isActive({ textAlign: "justify" }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const c = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Pemformatan teks">
      <Btn title="Tebal" label="B" active={s.bold} onClick={() => c().toggleBold().run()} />
      <Btn title="Miring" label="I" active={s.italic} onClick={() => c().toggleItalic().run()} />
      <Btn title="Garis bawah" label="U" active={s.underline} onClick={() => c().toggleUnderline().run()} />
      <span className="mx-1 w-px bg-line" />
      <Btn title="Judul 1" label="H1" active={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()} />
      <Btn title="Judul 2" label="H2" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} />
      <Btn title="Judul 3" label="H3" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} />
      <Btn title="Paragraf biasa" label="P" onClick={() => c().setParagraph().run()} />
      <span className="mx-1 w-px bg-line" />
      <Btn title="Daftar poin" label="• Daftar" active={s.bullet} onClick={() => c().toggleBulletList().run()} />
      <Btn title="Daftar nomor" label="1. Daftar" active={s.ordered} onClick={() => c().toggleOrderedList().run()} />
      <span className="mx-1 w-px bg-line" />
      <Btn title="Rata kiri" label="Kiri" active={s.left} onClick={() => c().setTextAlign("left").run()} />
      <Btn title="Rata tengah" label="Tengah" active={s.center} onClick={() => c().setTextAlign("center").run()} />
      <Btn title="Rata kanan" label="Kanan" active={s.right} onClick={() => c().setTextAlign("right").run()} />
      <Btn title="Rata kiri-kanan" label="Penuh" active={s.justify} onClick={() => c().setTextAlign("justify").run()} />
      <span className="mx-1 w-px bg-line" />
      <Btn title="Sisipkan halaman baru" label="Halaman baru" onClick={() => c().setHorizontalRule().run()} />
      <span className="mx-1 w-px bg-line" />
      <Btn title="Urungkan" label="Urungkan" disabled={!s.canUndo} onClick={() => c().undo().run()} />
      <Btn title="Ulangi" label="Ulangi" disabled={!s.canRedo} onClick={() => c().redo().run()} />
    </div>
  );
}

type Props = {
  initial: DocNode;
  format: ExportFormat;
  onEditorReady: (editor: Editor) => void;
  onDirty: () => void;
};

export default function DocEditor({ initial, format, onEditorReady, onDirty }: Props) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, blockquote: false, code: false, codeBlock: false, strike: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ParagraphLayout,
      FontSize,
      SizedImage,
      BorderedTable,
      TableRow,
      TableCell,
      TableHeader,
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: initial as unknown as Record<string, unknown>,
    immediatelyRender: false,
    onCreate: ({ editor: e }) => onEditorReady(e),
    onUpdate: () => onDirty(),
  });

  const w = PAPER_CM[format.paper];
  const m = format.margins;
  const paper: CSSProperties = {
    ["--cm" as string]: `${100 / w}cqw`,
    padding: `calc(var(--cm) * ${m.top}) calc(var(--cm) * ${m.right}) calc(var(--cm) * ${m.bottom}) calc(var(--cm) * ${m.left})`,
    fontFamily: `"${format.font}", "Times New Roman", serif`,
    fontSize: `calc(var(--cm) * 0.035278 * ${format.fontSize})`,
    lineHeight: format.lineSpacing * 1.15,
  };

  if (!editor) return <p className="text-sm text-muted">Menyiapkan editor...</p>;

  return (
    <div className="space-y-3">
      <Toolbar editor={editor} />
      <div className="rounded-md bg-neutral-200 p-3">
        <div style={{ containerType: "inline-size" }} className="mx-auto max-w-3xl">
          <div className="doc-editor bg-white text-black shadow" style={paper}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}
