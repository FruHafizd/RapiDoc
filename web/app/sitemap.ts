import type { MetadataRoute } from "next";
import { getSiteUrl, ROUTES } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return ROUTES.map((route) => ({ url: `${base}${route === "/" ? "/" : route}` }));
}
