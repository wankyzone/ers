import type { MetadataRoute } from "next";
import {
  isProductionDeployment,
  PRODUCTION_SITE_URL,
} from "../lib/site-config.ts";

export default function robots(): MetadataRoute.Robots {
  const sitemap = isProductionDeployment()
    ? new URL("/sitemap.xml", PRODUCTION_SITE_URL).toString()
    : undefined;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/"],
    },
    ...(sitemap ? { sitemap } : {}),
  };
}