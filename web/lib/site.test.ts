import { describe, expect, it } from "vitest";
import { getSiteUrl, ROUTES } from "./site";
import sitemap from "../app/sitemap";
import robots from "../app/robots";

describe("getSiteUrl", () => {
  it("memakai NEXT_PUBLIC_SITE_URL bila ada, tanpa garis miring di akhir", () => {
    expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://rapidoc.id/" })).toBe("https://rapidoc.id");
  });

  it("memakai domain produksi Vercel bila variabel utama tidak ada", () => {
    expect(getSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "rapidoc.vercel.app" })).toBe("https://rapidoc.vercel.app");
  });

  it("mengutamakan NEXT_PUBLIC_SITE_URL dibanding Vercel", () => {
    expect(
      getSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://rapidoc.id", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }),
    ).toBe("https://rapidoc.id");
  });

  it("jatuh ke localhost saat pengembangan", () => {
    expect(getSiteUrl({})).toBe("http://localhost:3000");
  });
});

describe("sitemap", () => {
  it("memuat semua rute publik dengan URL absolut", () => {
    const urls = sitemap().map((s) => s.url);
    expect(urls).toHaveLength(ROUTES.length);
    expect(urls).toContain(`${getSiteUrl(process.env)}/`);
    for (const r of ["/generator", "/upload", "/tentang", "/kontak"]) {
      expect(urls).toContain(`${getSiteUrl(process.env)}${r}`);
    }
    expect(urls.every((u) => u.startsWith("http"))).toBe(true);
  });
});

describe("robots", () => {
  it("mengizinkan semua dan menunjuk ke sitemap", () => {
    const r = robots();
    expect(r.rules).toEqual({ userAgent: "*", allow: "/" });
    expect(r.sitemap).toBe(`${getSiteUrl(process.env)}/sitemap.xml`);
  });
});
