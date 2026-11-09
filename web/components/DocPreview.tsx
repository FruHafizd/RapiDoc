"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import type { DocConfig } from "@/lib/docConfig";
import { buildPreviewPages, chapterLabel, type PreviewPage } from "@/lib/previewPages";

const PAPER_CM = { A4: { w: 21, h: 29.7 }, Letter: { w: 21.59, h: 27.94 } };
const SAMPLE =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

/** Satuan: 1 cm dan 1 pt dihitung dari lebar halaman, sehingga pratinjau selalu proporsional. */
const cm = (n: number) => `calc(var(--cm) * ${n})`;
const pt = (n: number) => `calc(var(--cm) * 0.035278 * ${n})`;

/** Data URL (tanpa siklus hidup object URL yang perlu di-revoke). */
function logoDataUrl(logo: DocConfig["cover"]["logo"]): string | undefined {
  if (!logo) return undefined;
  let binary = "";
  for (let i = 0; i < logo.data.length; i += 0x8000) {
    binary += String.fromCharCode(...logo.data.subarray(i, i + 0x8000));
  }
  return `data:${logo.type === "png" ? "image/png" : "image/jpeg"};base64,${btoa(binary)}`;
}

function P({ children, bold, before = 0 }: { children: ReactNode; bold?: boolean; before?: number }) {
  return (
    <p style={{ textAlign: "center", fontWeight: bold ? 700 : 400, margin: `${pt(before)} 0 ${pt(12)}` }}>
      {children}
    </p>
  );
}

const Body = () => (
  <p style={{ textAlign: "justify", textIndent: cm(1.25), margin: `0 0 ${pt(6)}` }}>{SAMPLE}</p>
);

function PageContent({ page, config, logoUrl }: { page: PreviewPage; config: DocConfig; logoUrl?: string }) {
  const { cover, withSample } = config;

  switch (page.kind) {
    case "cover": {
      const authors = cover.authors.filter((a) => a.name.trim());
      const inst = [cover.studyProgram, cover.faculty, cover.institution].filter((t) => t.trim());
      return (
        <>
          <P bold>MAKALAH</P>
          {cover.course.trim() && <P>Disusun untuk memenuhi tugas mata kuliah {cover.course.trim()}</P>}
          <P bold before={24}>
            {cover.title.toUpperCase()}
          </P>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo universitas"
              style={{ display: "block", margin: `${pt(24)} auto`, width: cm(3.97), height: "auto" }}
            />
          )}
          {cover.lecturer.trim() && (
            <>
              <P before={24}>Dosen Pengampu:</P>
              <P bold>{cover.lecturer.trim()}</P>
            </>
          )}
          <P before={24}>{authors.length > 1 ? "Disusun oleh kelompok:" : "Disusun oleh:"}</P>
          {authors.map((a, i) => (
            <P key={i} bold>
              {a.idNumber.trim() ? `${a.name.trim()} (${a.idNumber.trim()})` : a.name.trim()}
            </P>
          ))}
          {inst.map((t, i) => (
            <P key={i} bold before={i === 0 ? 36 : 0}>
              {t.trim().toUpperCase()}
            </P>
          ))}
          {cover.year.trim() && <P>{cover.year.trim()}</P>}
        </>
      );
    }
    case "foreword":
      return (
        <>
          <P bold>KATA PENGANTAR</P>
          {withSample && <Body />}
          <p style={{ textAlign: "right", margin: `${pt(24)} 0 0` }}>[Kota], [tanggal] [bulan] [tahun]</p>
          <p style={{ textAlign: "right", margin: 0 }}>Penulis</p>
        </>
      );
    case "toc":
      return (
        <>
          <P bold>DAFTAR ISI</P>
          {page.entries.map((e, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "baseline", gap: cm(0.1), paddingLeft: e.level === 2 ? cm(0.5) : 0, marginBottom: pt(6) }}
            >
              <span>{e.text}</span>
              <span style={{ flex: 1, borderBottom: `${pt(1)} dotted currentColor` }} />
              <span>{e.page}</span>
            </div>
          ))}
        </>
      );
    case "chapter":
      return (
        <>
          <P bold>
            {chapterLabel(page.index)}
            <br />
            {page.chapter.title.toUpperCase()}
          </P>
          {!page.chapter.subs.length && withSample && <Body />}
          {page.chapter.subs.map((s, j) => (
            <div key={j}>
              <p style={{ fontWeight: 700, margin: `${pt(6)} 0` }}>
                {String.fromCharCode(65 + (j % 26))}. {s}
              </p>
              {withSample && <Body />}
            </div>
          ))}
        </>
      );
    case "bibliography":
      return (
        <>
          <P bold>DAFTAR PUSTAKA</P>
          {withSample && <Body />}
        </>
      );
  }
}

export default function DocPreview({ config }: { config: DocConfig }) {
  const pages = buildPreviewPages(config);
  const logo = config.cover.logo;
  const logoUrl = useMemo(() => logoDataUrl(logo), [logo]);
  const { w, h } = PAPER_CM[config.paper];
  const m = config.margins;

  const pageStyle: CSSProperties = {
    ["--cm" as string]: `${100 / w}cqw`,
    position: "relative",
    aspectRatio: `${w} / ${h}`,
    overflow: "hidden",
    background: "#fff",
    color: "#000",
    boxShadow: "0 1px 3px rgba(0,0,0,.2)",
    fontFamily: `"${config.font}", "Times New Roman", serif`,
    fontSize: pt(config.fontSize),
    lineHeight: config.lineSpacing * 1.15,
    padding: `${cm(m.top)} ${cm(m.right)} ${cm(m.bottom)} ${cm(m.left)}`,
  };

  if (!pages.length) return <p className="text-sm text-muted">Belum ada halaman.</p>;

  return (
    <div className="space-y-4" aria-label="Pratinjau dokumen">
      {pages.map((page, i) => (
        <div key={i} className="mx-auto max-w-[26rem]" style={{ containerType: "inline-size" }} data-testid="preview-page">
          <div style={pageStyle}>
            <PageContent page={page} config={config} logoUrl={logoUrl} />
            {page.number && (
              <div style={{ position: "absolute", left: 0, right: 0, bottom: cm(1.25), textAlign: "center" }}>
                {page.number}
              </div>
            )}
          </div>
          <p className="mt-1 text-center text-xs text-muted">Halaman {i + 1}</p>
        </div>
      ))}
    </div>
  );
}
