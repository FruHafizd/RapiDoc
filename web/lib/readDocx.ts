import JSZip from "jszip";

export const MAX_DOCX_BYTES = 5 * 1024 * 1024;
/** Batas ukuran setelah dekompresi, untuk menahan berkas zip berbahaya. */
const MAX_XML_BYTES = 20 * 1024 * 1024;
const MAX_FOOTERS = 10;

const INVALID = "Berkas bukan dokumen .docx yang valid.";

export type DocxImage = { data: Uint8Array; type: "png" | "jpg" };

export type DocxParts = {
  documentXml: string;
  stylesXml: string;
  numberingXml: string;
  /** XML header dan footer; dipakai untuk mengetahui apakah dan di mana dokumen bernomor halaman. */
  headerXmls: string[];
  footerXmls: string[];
  /** Gambar PNG/JPEG yang ada di dokumen, berdasarkan id relasinya (rId). */
  images: Record<string, DocxImage>;
};

const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function readImages(zip: JSZip): Promise<Record<string, DocxImage>> {
  const rels = await readEntry(zip, "word/_rels/document.xml.rels");
  const images: Record<string, DocxImage> = {};
  if (!rels) return images;
  let total = 0;
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    if (Object.keys(images).length >= MAX_IMAGES) break;
    const tag = m[0];
    if (!/Type="[^"]*\/image"/.test(tag)) continue;
    const id = tag.match(/\bId="([^"]+)"/)?.[1];
    const target = tag.match(/\bTarget="([^"]+)"/)?.[1];
    const ext = target?.match(/\.(png|jpe?g)$/i)?.[1].toLowerCase();
    if (!id || !target || !ext || /^[a-z]+:/i.test(target) || target.includes("..")) continue;
    const entry = zip.file(`word/${target.replace(/^\//, "").replace(/^word\//, "")}`);
    if (!entry) continue;
    const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    if (typeof size === "number" && (size > MAX_IMAGE_BYTES || total + size > MAX_XML_BYTES)) continue;
    const data = await entry.async("uint8array");
    total += data.length;
    images[id] = { data, type: ext === "png" ? "png" : "jpg" };
  }
  return images;
}

async function readEntry(zip: JSZip, name: string): Promise<string | null> {
  const entry = zip.file(name);
  if (!entry) return null;
  // _data.uncompressedSize dibaca dari header zip sebelum berkas diekstrak.
  const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  if (typeof size === "number" && size > MAX_XML_BYTES) throw new Error("Dokumen terlalu besar untuk dibaca.");
  return entry.async("string");
}

/** Membaca bagian XML dari berkas .docx. Semua diproses di peramban. */
export async function readDocxXml(file: Blob): Promise<DocxParts> {
  if (file.size > MAX_DOCX_BYTES) throw new Error("Ukuran dokumen maksimal 5 MB.");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error(INVALID);
  }
  const documentXml = await readEntry(zip, "word/document.xml");
  if (documentXml === null) throw new Error(INVALID);
  const stylesXml = (await readEntry(zip, "word/styles.xml")) ?? "";
  const numberingXml = (await readEntry(zip, "word/numbering.xml")) ?? "";

  const headerNames = Object.keys(zip.files)
    .filter((n) => /^word\/header\d*\.xml$/.test(n))
    .slice(0, MAX_FOOTERS);
  const headerXmls: string[] = [];
  for (const n of headerNames) headerXmls.push((await readEntry(zip, n)) ?? "");

  const footerNames = Object.keys(zip.files)
    .filter((n) => /^word\/footer\d*\.xml$/.test(n))
    .slice(0, MAX_FOOTERS);
  const footerXmls: string[] = [];
  for (const n of footerNames) footerXmls.push((await readEntry(zip, n)) ?? "");

  return { documentXml, stylesXml, numberingXml, headerXmls, footerXmls, images: await readImages(zip) };
}
