export const SITE_NAME = "RapiDoc";

/** Rute publik yang masuk ke sitemap. */
export const ROUTES = ["/", "/generator", "/upload", "/tentang", "/kontak"];

/**
 * Alamat situs untuk URL absolut (sitemap, Open Graph). Domain belum ditentukan,
 * jadi dibaca dari environment: NEXT_PUBLIC_SITE_URL, lalu domain produksi Vercel,
 * lalu localhost saat pengembangan.
 */
export function getSiteUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
