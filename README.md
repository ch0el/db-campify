# Campify · Duke Baseball Camps

A React/TypeScript dashboard modeled on the Campify Figma V3 wireframe, with a Supabase Auth/PostgreSQL backend and a preview-first CSV importer.

## Run locally

Requires Node 22+ and npm.

```sh
npm ci
npm run dev
```

Open the printed local URL. Choose **Explore with demo data**, select dashboard features, and open the dashboard. Demo data is synthetic and stays in memory; reloading or signing out resets changes. No Supabase project is required for the demo.

```sh
npm run build
npm test
```

SQL tests execute the migration inside in-memory PostgreSQL (PGlite), including RLS isolation, atomic rollback, and idempotent imports. Browser checks use installed Google Chrome: with the dev server running on port 5173, run `node scripts/browser-check.mjs`.

## Connect a new Supabase project

1. Create a project at https://supabase.com/dashboard. Keep the database password private.
2. In **SQL Editor**, execute `supabase/migrations/202611190001_campify.sql` once, then execute `supabase/migrations/202611190002_clear_sample_data.sql`. This creates tables, policies, a read view, and the validated import RPC.
3. In **Authentication → Users**, create a staff account using an email and password. This app uses email as the staff ID.
4. In `supabase/bootstrap.sql`, replace the placeholder email with the staff email; execute it once in SQL Editor. This creates the Duke Baseball Camps program and grants that user membership. To add another staff user later, insert their auth UUID into `program_members` using the same program ID.
5. Copy `.env.example` to `.env`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the project's Connect dialog / API settings. A legacy public anon key also works. **Never use a service-role or secret key here.**
6. Restart the local dev server. Sign in with the staff credentials. A new project starts empty; upload a CSV to populate it.
7. For a hosted build, supply the same public build-time values and rebuild/redeploy. Vite embeds them at build time; changing runtime environment settings alone does not update the compiled frontend. Configure the live site origin in Supabase Auth's URL settings if adding email flows later.

The hosted production build is configured for the supplied Supabase project through `.env.production`. This tracked file contains only the public project URL and publishable browser key. Supabase Auth responds successfully, and anonymous access to programs and enrollment details is denied. Staff sign-in, program membership, and authenticated imports still need verification with a staff account. Demo mode remains available. Local development uses your ignored `.env` file; production builds use `.env.production`.

## CSV contract (placeholder Teamworks mapping)

No actual Teamworks Camps export was supplied. These headers are a starter format, not a claim about Teamworks' exact export schema. The upload screen lets staff map differently named columns before importing.

| Placeholder column | Required | Meaning |
| --- | --- | --- |
| Registration ID | Yes | Stable ID for one enrollment; repeated IDs update the record |
| Participant ID | Yes | Stable player ID across years; names alone are not used to deduplicate |
| Participant Name | Yes | Display name |
| Camp ID | Yes | Stable ID for this specific camp occurrence |
| Camp Name | Yes | Camp display name |
| Camp Type | No | Skills, Youth, Prospect, or another category; defaults to General |
| Start Date | Yes | Camp start date |
| End Date | Yes | Camp end date, inclusive |
| Registration Date | Yes | Date the registration was recorded |
| School | No | School at enrollment; defaults to Unknown |
| District | No | District at enrollment; defaults to Unknown |
| Referral Source | No | Self-reported source; defaults to Unknown |
| Status | No | confirmed / cancelled / waitlisted; defaults to confirmed |
| Amount Paid | No | Nonnegative USD with up to two decimal places; defaults to zero |

Dates accept YYYY-MM-DD or M/D/YYYY. Files are limited to 5 MB and 5,000 enrollments. Download a small sample from **Upload CSV**, or import the full synthetic `public/campify-demo-enrollments.csv` into a test Supabase project. Regenerate the seed export with `node --experimental-strip-types scripts/export-demo.mjs`.

Imports validate column mapping, required values, dates, amounts, statuses, duplicate registration IDs, and conflicting camp details. Writes are atomic. Repeating the same file hash is a no-op. Later exports update matching IDs but do not delete absent registrations. Existing registration IDs cannot be reassigned to another player or camp. No original CSV is retained; only mapped fields and import receipts are saved.

## Metrics and features

- **Overview:** enrollment change, first-seen players, goal progress, referral distribution, school/district coverage, calendar.
- **Goals:** selectable 1–5-year window, annual enrollment line, average line, above/below-average point colors, editable yearly target.
- **New players:** distinct participant IDs first seen in confirmed records, using all imported years; returning cohorts and yearly totals.
- **Demographics:** school and district snapshots by camp year, multi-year counts, search.
- **Calendar:** month/week/day views, previous/next/today, date selection and all-day camp details.
- **Enrollment:** annual counts, amount paid, referral sources and camp-type distribution.
- **Upload CSV:** editable column mapper, validation, five-row preview, atomic save, duplicate protection, history.
- **Profile/features:** staff display name and persisted dashboard preferences.
- **Issue reports:** authenticated reports saved to `issues`; demo reports stay in memory. No email or external support ticket is sent.
- **Loading:** initial HTML fallback, session loading, data skeleton, refresh/retry and empty states.

Enrollment metrics count only confirmed registrations and group by **camp start year**, not registration year. Demographics count enrollments, so one player attending two camps counts twice. Player metrics deduplicate by participant ID. The first imported year cannot prove first-ever attendance. Missing years show zero; missing demographics stay Unknown. Referral-source counts are not ad impressions or advertising reach.

## Security and scope

RLS limits data to authenticated program members. Membership is provisioned by an administrator rather than client-editable profile metadata. The import RPC checks membership explicitly, validates input server-side, serializes imports per program, and commits all rows together. The browser never needs a privileged database key. Live enrollment data is not cached in localStorage.

This initial version supports one program per staff account. Camp calendar entries are all-day because the placeholder export contains dates rather than times. Dataset reads are paginated in 1,000-row batches; large production histories may warrant server-side aggregate queries. Import history shows the most recent 50 files. No automatic refresh schedule is assumed.

See `docs/IMPLEMENTATION.md` for design mapping and data decisions. Fonts are Geist/Geist Mono (SIL Open Font License); Figma assets were exported from the supplied Campify file for this implementation.

## Clear sample data

Open **Upload CSV → Sample data → Clear sample data**, review the count, then confirm. This deletes sample enrollments across all years in your own program, removes unused sample players/camps and unreferenced associated import receipts, and refreshes the dashboard. Real enrollments, staff access, profiles and goals are preserved. Sample IDs are reserved: `DEMO-2022-…` through `DEMO-2026-…`, `DEMO-P…`, and `DEMO-C2022-0` through `DEMO-C2026-2`. All three ID patterns must match before an enrollment is deleted. Do not use these reserved IDs for real Teamworks records.

Existing databases require migration `202611190002_clear_sample_data.sql` once to enable this action.
