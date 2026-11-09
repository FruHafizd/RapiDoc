export type PageNumberPosition = "bottom-center" | "bottom-right" | "top-right";

export type PageNumberDetection = { enabled: boolean; position: PageNumberPosition };

const HAS_PAGE_FIELD = /<w:instrText[^>]*>\s*PAGE\b|<w:fldSimple\b[^>]*\bw:instr="\s*PAGE\b/;

const paragraphsWithPage = (xml: string) => (xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? []).filter((p) => HAS_PAGE_FIELD.test(p));

const hasPage = (xml: string) => HAS_PAGE_FIELD.test(xml);

const alignOf = (xml: string) => paragraphsWithPage(xml)[0]?.match(/<w:jc\b[^>]*\bw:val="([^"]+)"/)?.[1];

/**
 * Memperkirakan apakah dan di mana nomor halaman dipasang. Header lebih diutamakan
 * karena bagian isi makalah umumnya bernomor di kanan atas; posisi lain didekatkan
 * ke pilihan yang didukung (bawah tengah, bawah kanan, atas kanan).
 */
export function detectPageNumbers(headerXmls: string[], footerXmls: string[]): PageNumberDetection {
  if (headerXmls.some(hasPage)) return { enabled: true, position: "top-right" };
  const footer = footerXmls.find(hasPage);
  if (footer === undefined) return { enabled: false, position: "bottom-center" };
  const jc = alignOf(footer);
  return { enabled: true, position: jc === "right" || jc === "end" ? "bottom-right" : "bottom-center" };
}
