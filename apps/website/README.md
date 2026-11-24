# ERS Website

This Next.js application is part of the ERS pnpm monorepo. The initial import is based on
`wankyzone/ers-website@839d3c293568c04b31583c66f595d5f30055ad7d`.

## Commands

Run commands from the monorepo root:

```bash
pnpm --filter @ers/website dev
pnpm --filter @ers/website build
pnpm --filter @ers/website lint
pnpm --filter @ers/website typecheck
pnpm --filter @ers/website test
```

For a monorepo deployment, use `apps/website` as the Vercel Root Directory,
install from the repository root with `pnpm install --frozen-lockfile`, and
build the website with `pnpm --filter @ers/website build`.

## Environment variables

The website's legacy waitlist administration is disabled unless the server-only
`ERS_WAITLIST_ADMIN_ENABLED` variable is exactly `true`. Set it before building
or deploying; changing it requires a new deployment. If explicitly enabled, the
admin also requires the server-only `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and
`SUPABASE_SERVICE_ROLE_KEY`, plus the public Supabase URL
`NEXT_PUBLIC_SUPABASE_URL`. The service-role key and admin credentials must
never be exposed to client-side code. Enabling this legacy admin requires an
explicit security decision and separate environment-specific configuration.

Customer authentication uses `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` through Supabase SSR browser, server, and proxy
clients. Configure Supabase Auth email/password signup, email confirmation,
password recovery, and the site's `/auth/callback` redirect URL in the
appropriate Supabase project. Preview deployments must use an isolated
non-production project. The customer identity migration under
`apps/website/supabase/migrations/` is a review artifact and has not been run;
reconcile and approve it through the central database migration process before
enabling customer authentication.

`RESEND_API_KEY` is referenced by retained waitlist email code; the public
waitlist signup route is disabled, so that email delivery is not part of the
current website behavior.

Preview metadata relies on Vercel's system environment variables `VERCEL_ENV`
and `VERCEL_URL`. Keep Vercel system environment variables enabled. Only
`VERCEL_ENV=production` enables indexing and the production sitemap; Preview
and local environments are non-indexable. Preview metadata uses its deployment
host when `VERCEL_URL` is available and otherwise falls back to localhost.

The site applies baseline response headers, with HSTS limited to Production.
A Content Security Policy is intentionally not enabled yet: the current Google
Analytics integration injects third-party scripts and an inline bootstrap. A
strict policy needs nonce-aware integration and browser validation; do not
weaken it with an unreviewed `unsafe-inline` policy.

## Waitlist administration

The imported `/admin` dashboard is a standalone waitlist administration tool. It remains separate
from `apps/admin`. When disabled, `/admin` returns 404 and its login, listing, and export APIs
return 503 without accessing waitlist data. Logout remains available to clear any existing
browser session.

The waitlist/referral API and email source are retained as imported. The waitlist SQL files under
`supabase/migrations/` are source artifacts for reconciliation only; they are not part of the
central active migration stream and must not be run from this app.

## Product and deployment status

The public waitlist page is disabled and the public submission endpoint returns `410 Gone`.
The waitlist administration, referral, email, and database migration artifacts remain for
controlled review. Customer signup, sign-in, email verification, password recovery, and a
protected profile dashboard are implemented, subject to the required Supabase configuration
and approved customer identity migration. Runner application web journeys are not implemented
here. The errand creation API is a non-operational placeholder and returns `501 Not Implemented`;
it does not create errands or call external services.

Preview environments must use an isolated non-production Supabase project. Never configure
Preview to write to Production Supabase.

No Vercel project or Preview deployment is configured by this repository. Before Preview,
create and protect the separately approved Vercel project, verify the `apps/website` root and
Preview/Production environment separation, and confirm the isolated non-production Supabase
resources. Do not attach the Production domain until cutover approval.

## Source configuration notes

- The website uses the existing ERS logo image for Open Graph previews. The source did not include
  dedicated Open Graph or Apple touch icon assets.
- The source-provided Lagos map asset has a leading space in its filename. It is preserved as-is
  and is not referenced by the imported pages.
- Tailwind 4 theme tokens are expressed in `app/globals.css`; the standalone repository's legacy
  Tailwind config files are not used by this workspace.
