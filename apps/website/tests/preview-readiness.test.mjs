import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import robots from "../app/robots.ts";
import sitemap from "../app/sitemap.ts";
import { getSiteUrl, isProductionDeployment } from "../lib/site-config.ts";
import { getSecurityHeaders } from "../lib/security-headers.ts";

function withVercelEnvironment(environment, run) {
  const previousEnvironment = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
  };
  if (environment.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = environment.VERCEL_ENV;

  if (environment.VERCEL_URL === undefined) delete process.env.VERCEL_URL;
  else process.env.VERCEL_URL = environment.VERCEL_URL;

  try {
    return run();
  } finally {
    if (previousEnvironment.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnvironment.VERCEL_ENV;

    if (previousEnvironment.VERCEL_URL === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = previousEnvironment.VERCEL_URL;
  }
}

test("Preview site URLs use the deployment host and are not indexable", () => {
  const environment = {
    VERCEL_ENV: "preview",
    VERCEL_URL: "ers-website-feature-example.vercel.app",
  };

  withVercelEnvironment(environment, () => {
    assert.equal(
      getSiteUrl(environment).toString(),
      "https://ers-website-feature-example.vercel.app/",
    );
    assert.equal(isProductionDeployment(environment), false);
    assert.deepEqual(robots(), {
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/"],
      },
    });
    assert.deepEqual(sitemap(), []);
  });
});

test("Production keeps the approved domain and public sitemap", () => {
  withVercelEnvironment(
    {
      VERCEL_ENV: "production",
      VERCEL_URL: "ers-production-example.vercel.app",
    },
    () => {
      assert.equal(
        getSiteUrl().toString(),
        "https://ers.wankysoftware.com/",
      );
      assert.equal(isProductionDeployment(), true);
      assert.deepEqual(robots(), {
        rules: {
          userAgent: "*",
          allow: "/",
          disallow: ["/admin", "/api/"],
        },
        sitemap: "https://ers.wankysoftware.com/sitemap.xml",
      });
      assert.ok(sitemap().length > 0);
      assert.ok(
        sitemap().every((entry) =>
          entry.url.startsWith("https://ers.wankysoftware.com/"),
        ),
      );
      assert.ok(sitemap().every((entry) => !entry.url.endsWith("/waitlist")));
    },
  );
});

test("Unknown deployment environments fail closed for indexing and production URLs", () => {
  const environment = {
    VERCEL_ENV: "preview",
    VERCEL_URL: "not a valid host",
  };

  assert.equal(getSiteUrl(environment).toString(), "http://localhost:3000/");
  assert.equal(isProductionDeployment(environment), false);
});

test("public pages do not advertise unfinished runner or blog actions", async () => {
  const [runnerPage, blogPage] = await Promise.all([
    readFile(new URL("../app/for-runners/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/blog/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(runnerPage, /Runner applications are not available through this website yet\./);
  assert.doesNotMatch(runnerPage, /href=["']\/(?:signup|register|apply)/i);
  assert.doesNotMatch(blogPage, /href=["']#["']/i);
  assert.doesNotMatch(blogPage, /building ERS in public/i);
});

test("security headers are applied without CSP and HSTS is Production-only", () => {
  const previewHeaders = getSecurityHeaders("preview");
  const productionHeaders = getSecurityHeaders("production");
  const previewHeaderMap = new Map(
    previewHeaders.map(({ key, value }) => [key, value]),
  );
  const productionHeaderMap = new Map(
    productionHeaders.map(({ key, value }) => [key, value]),
  );

  assert.equal(previewHeaderMap.get("X-Content-Type-Options"), "nosniff");
  assert.equal(
    previewHeaderMap.get("Referrer-Policy"),
    "strict-origin-when-cross-origin",
  );
  assert.equal(previewHeaderMap.get("X-Frame-Options"), "DENY");
  assert.equal(
    previewHeaderMap.get("Permissions-Policy"),
    "camera=(), microphone=(), geolocation=()",
  );
  assert.equal(previewHeaderMap.has("Strict-Transport-Security"), false);
  assert.equal(
    productionHeaderMap.get("Strict-Transport-Security"),
    "max-age=31536000",
  );
});
