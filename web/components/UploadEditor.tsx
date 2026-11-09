"use client";

import type { Editor } from "@tiptap/react";
import { useRef, useState } from "react";
import DocEditor, { getDocJson } from "@/components/DocEditor";
import { defaultConfig } from "@/lib/docConfig";
import { detectFormat } from "@/lib/detectFormat";
import { detectPageNumbers, type PageNumberPosition } from "@/lib/detectPageNumbers";
import type { DocNode } from "@/lib/docModel";
import { docToDocx, type ExportFormat } from "@/lib/docToDocx";
import { docxToDoc } from "@/lib/docxToDoc";
import { readDocxXml } from "@/lib/readDocx";

const FONTS = ["Times New Roman", "Arial", "Calibri"];
const input = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const MARGIN_LABEL = { top: "atas", bottom: "bawah", left: "kiri", right: "kanan" } as const;

type Loaded = {
  fileName: string;
  doc: DocNode;
  format: ExportFormat;
  found: string[];
  notes: string[];
};

const safeName = (name: string) =>
  name.replace(/\.docx$/i, "").replace(/[^\w\-. ()]+/g, "_").trim().slice(0, 80) || "dokumen";

export default function UploadEditor() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [format, setFormat] = useState<ExportFormat>({
    paper: defaultConfig.paper,
    margins: defaultConfig.margins,
    font: defaultConfig.font,
    fontSize: defaultConfig.fontSize,
    lineSpacing: defaultConfig.lineSpacing,
    pageNumbers: true,
    pageNumberPosition: "bottom-center",
    skipFirstPage: false,
  });
  const [loadKey, setLoadKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const dirty = useRef(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (dirty.current && !window.confirm("Perubahan pada dokumen saat ini belum diunduh dan akan hilang. Lanjutkan?")) return;
    setError("");
    setBusy(true);
    try {
      const parts = await readDocxXml(file);
      const { doc, images } = docxToDoc(parts);
      if (doc.content.length === 0) throw new Error("Tidak ada isi yang bisa dibaca dari dokumen ini.");
      const { patch, found, missing } = detectFormat(parts.documentXml, parts.stylesXml);
      const pageNumbers = detectPageNumbers(parts.headerXmls, parts.footerXmls);
      const fmt: ExportFormat = {
        paper: patch.paper ?? defaultConfig.paper,
        margins: patch.margins ?? defaultConfig.margins,
        font: patch.font ?? defaultConfig.font,
        fontSize: patch.fontSize ?? defaultConfig.fontSize,
        lineSpacing: patch.lineSpacing ?? defaultConfig.lineSpacing,
        pageNumbers: pageNumbers.enabled,
        pageNumberPosition: pageNumbers.position,
        skipFirstPage: patch.cover?.enabled ?? false,
      };
      const notes = [...missing.filter((m) => /kertas|font|spasi/i.test(m))];
      if (images > 0) notes.push(`${images} gambar di dokumen asli tidak ditampilkan dan tidak ikut diunduh.`);
      if ((parts.documentXml.match(/<w:sectPr/g)?.length ?? 0) > 1) {
        notes.push(
          "Dokumen asli terdiri dari beberapa bagian dengan pengaturan halaman sendiri (mis. nomor romawi). Hasil unduhan menyatukannya menjadi satu urutan nomor halaman.",
        );
      }
      if (patch.sections?.toc) {
        notes.push("Daftar isi tampil sebagai teks biasa; nomor halamannya tidak diperbarui otomatis saat Anda mengedit.");
      }
      dirty.current = false;
      editorRef.current = null;
      setFormat(fmt);
      setLoaded({ fileName: file.name, doc, format: fmt, found, notes });
      setLoadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dokumen tidak dapat dibaca.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!editorRef.current || !loaded) return;
    setExporting(true);
    setError("");
    try {
      const blob = await docToDocx(getDocJson(editorRef.current), format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName(loaded.fileName)}-rapidoc.docx`;
      a.click();
      URL.revokeObjectURL(url);
      dirty.current = false;
    } catch {
      setError("Gagal membuat dokumen. Coba lagi.");
    } finally {
      setExporting(false);
    }
  }

  const setMargin = (k: keyof ExportFormat["margins"], v: string) =>
    setFormat((f) => ({ ...f, margins: { ...f.margins, [k]: Number(v) } }));

  return (
    <div className="space-y-6">
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-line bg-white p-6 text-center">
        <input
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          aria-label="Unggah dokumen"
          disabled={busy}
          onChange={onFile}
          className="peer sr-only"
        />
        <span className="font-medium">{loaded ? "Ganti dengan dokumen lain" : "Pilih dokumen .docx"}</span>
        <span className="text-sm text-muted">Maksimal 5 MB</span>
        <span className="mt-3 rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-ink transition-colors peer-hover:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-50">
          {busy ? "Membaca..." : "Pilih file"}
        </span>
      </label>

      {busy && <p className="text-sm text-muted">Membaca dokumen...</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {loaded && (
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div data-testid="editor-area" className="min-w-0">
            <DocEditor
              key={loadKey}
              initial={loaded.doc}
              format={format}
              onEditorReady={(e) => (editorRef.current = e)}
              onDirty={() => (dirty.current = true)}
            />
          </div>

          <aside className="h-fit min-w-0 space-y-5 rounded-md border border-line bg-white p-5 text-sm lg:sticky lg:top-4">
            <div className="min-w-0">
              <h2 className="font-serif text-xl font-semibold [overflow-wrap:anywhere]">{loaded.fileName}</h2>
              <p className="mt-1 text-xs text-muted">Edit langsung di halaman, lalu unduh.</p>
            </div>

            <button
              type="button"
              onClick={download}
              disabled={exporting}
              className="w-full rounded-md bg-accent px-4 py-3 font-medium text-accent-ink transition-colors hover:bg-ink disabled:opacity-50"
            >
              {exporting ? "Membuat..." : "Unduh .docx"}
            </button>

            <fieldset className="space-y-3" data-testid="format-panel">
              <legend className="mb-1 font-medium">Format terdeteksi</legend>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Kertas</span>
                <select
                  className={input}
                  value={format.paper}
                  onChange={(e) => setFormat({ ...format, paper: e.target.value as ExportFormat["paper"] })}
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(["top", "bottom", "left", "right"] as const).map((k) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-xs text-muted">Margin {MARGIN_LABEL[k]} (cm)</span>
                    <input
                      type="number"
                      min={0.5}
                      max={6}
                      step={0.01}
                      className={input}
                      value={format.margins[k]}
                      onChange={(e) => setMargin(k, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">Font</span>
                  <select className={input} value={format.font} onChange={(e) => setFormat({ ...format, font: e.target.value })}>
                    {(FONTS.includes(format.font) ? FONTS : [...FONTS, format.font]).map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">Ukuran (pt)</span>
                  <input
                    type="number"
                    min={8}
                    max={16}
                    className={input}
                    value={format.fontSize}
                    onChange={(e) => setFormat({ ...format, fontSize: Number(e.target.value) })}
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Spasi baris</span>
                <select
                  className={input}
                  value={format.lineSpacing}
                  onChange={(e) => setFormat({ ...format, lineSpacing: Number(e.target.value) as ExportFormat["lineSpacing"] })}
                >
                  <option value={1}>1</option>
                  <option value={1.5}>1,5</option>
                  <option value={2}>2</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-accent"
                  checked={format.pageNumbers}
                  onChange={(e) => setFormat({ ...format, pageNumbers: e.target.checked })}
                />
                Nomor halaman
              </label>
              <label className={`block ${format.pageNumbers ? "" : "opacity-50"}`}>
                <span className="mb-1 block text-xs text-muted">Posisi nomor</span>
                <select
                  className={input}
                  disabled={!format.pageNumbers}
                  value={format.pageNumberPosition}
                  onChange={(e) => setFormat({ ...format, pageNumberPosition: e.target.value as PageNumberPosition })}
                >
                  <option value="bottom-center">Bawah tengah</option>
                  <option value="bottom-right">Bawah kanan</option>
                  <option value="top-right">Atas kanan</option>
                </select>
              </label>
              <label className={`flex items-center gap-2 ${format.pageNumbers ? "" : "opacity-50"}`}>
                <input
                  type="checkbox"
                  className="size-4 accent-accent"
                  disabled={!format.pageNumbers}
                  checked={format.skipFirstPage}
                  onChange={(e) => setFormat({ ...format, skipFirstPage: e.target.checked })}
                />
                Tanpa nomor di halaman pertama
              </label>
            </fieldset>

            {loaded.notes.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted" data-testid="notes">
                {loaded.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted">
              Format dan isi dibaca otomatis dan bisa keliru. Periksa hasilnya di halaman sebelum diunduh.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
