"use client";

import { useState } from "react";
import { buildDocx } from "@/lib/buildDocx";
import DocPreview from "@/components/DocPreview";
import { chaptersToText, defaultConfig, parseChapters, presets, type DocConfig, type Logo } from "@/lib/docConfig";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const input =
  "w-full rounded-md border border-line bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-accent";
const legend = "font-serif text-xl font-semibold";

const MARGIN_LABEL = { top: "atas", bottom: "bawah", left: "kiri", right: "kanan" } as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-accent"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export default function GeneratorForm() {
  const [c, setC] = useState<DocConfig>(defaultConfig);
  const [chaptersText, setChaptersText] = useState(chaptersToText(defaultConfig.sections.chapters));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [logoError, setLogoError] = useState("");

  const chapters = parseChapters(chaptersText);
  const config: DocConfig = { ...c, sections: { ...c.sections, chapters } };

  const setMargin = (k: keyof DocConfig["margins"], v: string) =>
    setC({ ...c, margins: { ...c.margins, [k]: Number(v) } });
  const setCover = (k: keyof DocConfig["cover"], v: string | boolean) =>
    setC({ ...c, cover: { ...c.cover, [k]: v } });
  const setAuthors = (authors: DocConfig["cover"]["authors"]) => setC({ ...c, cover: { ...c.cover, authors } });
  const setAuthor = (i: number, k: "name" | "idNumber", v: string) =>
    setAuthors(c.cover.authors.map((a, j) => (j === i ? { ...a, [k]: v } : a)));
  const addAuthor = () => setAuthors([...c.cover.authors, { name: "", idNumber: "" }]);
  const removeAuthor = (i: number) => setAuthors(c.cover.authors.filter((_, j) => j !== i));
  const setSection =(k: "foreword" | "toc" | "bibliography", v: boolean) =>
    setC({ ...c, sections: { ...c.sections, [k]: v } });

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setC({ ...p.config, cover: c.cover, sections: c.sections, withSample: c.withSample });
  };

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError("");
    const type = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : null;
    if (!type) return setLogoError("Logo harus berformat PNG atau JPG.");
    if (file.size > MAX_LOGO_BYTES) return setLogoError("Ukuran logo maksimal 2 MB.");
    try {
      const bmp = await createImageBitmap(file);
      const logo: Logo = {
        data: new Uint8Array(await file.arrayBuffer()),
        type,
        width: bmp.width,
        height: bmp.height,
      };
      bmp.close();
      setC((prev) => ({ ...prev, cover: { ...prev.cover, logo } }));
    } catch {
      setLogoError("Gambar tidak dapat dibaca. Coba file lain.");
    }
  }

  async function download() {
    setBusy(true);
    setError("");
    try {
      const blob = await buildDocx(config);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "template-makalah.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Gagal membuat dokumen. Periksa isian lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_30rem]">
      <form className="space-y-10" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="space-y-4">
          <legend className={legend}>Format halaman</legend>
          <Field label="Preset">
            <select className={input} defaultValue="umum" onChange={(e) => applyPreset(e.target.value)}>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Ukuran kertas">
              <select
                className={input}
                value={c.paper}
                onChange={(e) => setC({ ...c, paper: e.target.value as DocConfig["paper"] })}
              >
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
              </select>
            </Field>
            <Field label="Font">
              <select className={input} value={c.font} onChange={(e) => setC({ ...c, font: e.target.value })}>
                <option>Times New Roman</option>
                <option>Arial</option>
                <option>Calibri</option>
              </select>
            </Field>
            <Field label="Ukuran font (pt)">
              <input
                type="number"
                min={8}
                max={16}
                className={input}
                value={c.fontSize}
                onChange={(e) => setC({ ...c, fontSize: Number(e.target.value) })}
              />
            </Field>
            <Field label="Spasi baris">
              <select
                className={input}
                value={c.lineSpacing}
                onChange={(e) => setC({ ...c, lineSpacing: Number(e.target.value) as DocConfig["lineSpacing"] })}
              >
                <option value={1}>1</option>
                <option value={1.5}>1,5</option>
                <option value={2}>2</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(["top", "bottom", "left", "right"] as const).map((k) => (
              <Field key={k} label={`Margin ${MARGIN_LABEL[k]} (cm)`}>
                <input
                  type="number"
                  min={0.5}
                  max={6}
                  step={0.01}
                  className={input}
                  value={c.margins[k]}
                  onChange={(e) => setMargin(k, e.target.value)}
                />
              </Field>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className={legend}>Cover</legend>
          <Check label="Sertakan cover" checked={c.cover.enabled} onChange={(v) => setCover("enabled", v)} />
          {c.cover.enabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Judul">
                <input className={input} value={c.cover.title} onChange={(e) => setCover("title", e.target.value)} />
              </Field>
              <Field label="Mata kuliah">
                <input className={input} value={c.cover.course} onChange={(e) => setCover("course", e.target.value)} />
              </Field>
              <Field label="Dosen pengampu">
                <input
                  className={input}
                  value={c.cover.lecturer}
                  onChange={(e) => setCover("lecturer", e.target.value)}
                />
              </Field>
              <Field label="Program studi">
                <input
                  className={input}
                  value={c.cover.studyProgram}
                  onChange={(e) => setCover("studyProgram", e.target.value)}
                />
              </Field>
              <Field label="Fakultas">
                <input className={input} value={c.cover.faculty} onChange={(e) => setCover("faculty", e.target.value)} />
              </Field>
              <Field label="Institusi / universitas">
                <input
                  className={input}
                  value={c.cover.institution}
                  onChange={(e) => setCover("institution", e.target.value)}
                />
              </Field>
              <Field label="Tahun">
                <input className={input} value={c.cover.year} onChange={(e) => setCover("year", e.target.value)} />
              </Field>
            </div>
          )}
          {c.cover.enabled && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Logo universitas (PNG atau JPG, maks. 2 MB)</p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  aria-label="Unggah logo universitas"
                  onChange={onLogoChange}
                  className="text-sm"
                />
                {c.cover.logo && (
                  <button
                    type="button"
                    onClick={() => setC({ ...c, cover: { ...c.cover, logo: undefined } })}
                    className="rounded-md border border-line px-3 py-1 text-sm text-muted hover:text-ink"
                  >
                    Hapus logo
                  </button>
                )}
              </div>
              {c.cover.logo && <p className="text-xs text-muted">Logo terpasang ({c.cover.logo.width} x {c.cover.logo.height} px).</p>}
              {logoError && (
                <p role="alert" className="text-xs text-red-700">
                  {logoError}
                </p>
              )}
              <p className="text-xs text-muted">Logo hanya diproses di peramban Anda dan tidak diunggah ke server.</p>
            </div>
          )}
          {c.cover.enabled && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Penulis ({c.cover.authors.length}){c.cover.authors.length > 1 ? " - makalah kelompok" : ""}
              </p>
              {c.cover.authors.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    aria-label={`Nama penulis ${i + 1}`}
                    placeholder="Nama"
                    className={input}
                    value={a.name}
                    onChange={(e) => setAuthor(i, "name", e.target.value)}
                  />
                  <input
                    aria-label={`NIM / NIP penulis ${i + 1}`}
                    placeholder="NIM / NIP"
                    className={`${input} sm:max-w-44`}
                    value={a.idNumber}
                    onChange={(e) => setAuthor(i, "idNumber", e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={`Hapus penulis ${i + 1}`}
                    disabled={c.cover.authors.length === 1}
                    onClick={() => removeAuthor(i)}
                    className="rounded-md border border-line px-3 text-muted hover:text-ink disabled:opacity-40"
                  >
                    Hapus
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addAuthor}
                className="rounded-md border border-accent px-3 py-2 text-sm text-accent hover:bg-accent hover:text-accent-ink"
              >
                + Tambah anggota
              </button>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className={legend}>Struktur</legend>
          <div className="flex flex-wrap gap-6">
            <Check label="Kata pengantar" checked={c.sections.foreword} onChange={(v) => setSection("foreword", v)} />
            <Check label="Daftar isi" checked={c.sections.toc} onChange={(v) => setSection("toc", v)} />
            <Check
              label="Daftar pustaka"
              checked={c.sections.bibliography}
              onChange={(v) => setSection("bibliography", v)}
            />
          </div>
          <Field label="Bab dan sub-bab (satu per baris, awali sub-bab dengan -)">
            <textarea
              rows={8}
              className={input}
              value={chaptersText}
              onChange={(e) => setChaptersText(e.target.value)}
            />
          </Field>
          <Field label="Isi dokumen">
            <select
              className={input}
              value={c.withSample ? "sample" : "empty"}
              onChange={(e) => setC({ ...c, withSample: e.target.value === "sample" })}
            >
              <option value="empty">Template kosong (hanya format)</option>
              <option value="sample">Dengan contoh isi</option>
            </select>
          </Field>
        </fieldset>
      </form>

      <aside className="h-fit space-y-4 rounded-md border border-line bg-white p-5 lg:sticky lg:top-4">
        <h2 className={legend}>Pratinjau</h2>
        <p className="text-xs text-muted">
          {config.paper}, {config.font} {config.fontSize} pt, spasi {config.lineSpacing}. Tampilan mendekati hasil di
          Word; panjang isi sebenarnya bisa menambah halaman.
        </p>
        <button
          type="button"
          onClick={download}
          disabled={busy || chapters.length === 0}
          className="w-full rounded-md bg-accent px-4 py-3 font-medium text-accent-ink transition-colors hover:bg-ink disabled:opacity-50"
        >
          {busy ? "Membuat..." : "Unduh .docx"}
        </button>
        {chapters.length === 0 && <p className="text-xs text-red-700">Isi minimal satu judul bab.</p>}
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
        <p className="text-xs text-muted">
          Saat file pertama kali dibuka di Word, pilih <strong>Yes</strong> pada permintaan memperbarui field, atau
          tekan F9 pada daftar isi agar nomor halamannya terisi.
        </p>
        <div className="max-h-[60vh] overflow-y-auto rounded-md bg-neutral-200 p-3">
          <DocPreview config={config} />
        </div>
      </aside>
    </div>
  );
}
