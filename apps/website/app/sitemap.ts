import type { MetadataRoute } from "next";
import {
  isProductionDeployment,
  PRODUCTION_SITE_URL,
} from "../lib/site-config.ts";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isProductionDeployment()) return [];

  const baseUrl = PRODUCTION_SITE_URL.toString().replace(/\/$/, "");

  return [
    { url: `${baseUrl}/`, lastModified: new Date() },
    { url: `${baseUrl}/about`, lastModified: new Date() },
    { url: `${baseUrl}/how-it-works`, lastModified: new Date() },
    { url: `${baseUrl}/for-runners`, lastModified: new Date() },
    { url: `${baseUrl}/pricing`, lastModified: new Date() },
    { url: `${baseUrl}/safety`, lastModified: new Date() },
    { url: `${baseUrl}/privacy-policy`, lastModified: new Date() },
    { url: `${baseUrl}/terms-of-service`, lastModified: new Date() },
    { url: `${baseUrl}/cookie-policy`, lastModified: new Date() },
    { url: `${baseUrl}/careers`, lastModified: new Date() },
    { url: `${baseUrl}/blog`, lastModified: new Date() },
  ];
}
