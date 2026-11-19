# Campify implementation notes

## Design reference

Source: Campify UI, Main Mockup / V3, Figma file cG08pwZCrDj1QonxWtX2bx, frame 1:20.
Read through the connected Duke account. The whole-frame design-context request timed out; individual widgets returned full code and screenshots: 31:2, 32:109, 32:69, 35:2, 42:227, 38:2, and 26:3.

The supplied design takes precedence over the generic frontend taste rules: stone background and panels, red metric panels, 35px corner radii, Geist/Geist Mono, oversized greeting, and original baseball/arrow/gauge artwork are intentional. No generic style draw replaces this existing design. Dashboard grid follows the original 732:428 left/right split with a 24px gap; left top is 232:476, left bottom 476:232. The shell adds navigation, year selection, upload, profile, and data-state controls absent from the wireframe.

Original SVG assets are downloaded locally under public/figma. Their root dimensions are preserved. Data-dependent donut segments, bars, and date positions are rendered from enrollment records rather than used as fixed illustrations. The demographic widget replaces the unsupported advertising reach estimate with actual imported school/district coverage. Donut denominator is an explicit enrollment goal, never invented camp capacity. New-player widget uses yearly cohorts to match the feature brief. Goal comparison cycles Now / Best past year / Goal; detail pages extend the design's type, palette, panels, and controls.

## Data and jobs

- Staff user: Mickey; review program progress and import periodic Teamworks CSV exports.
- Frequency was not specified beyond the staff name; no automatic refresh schedule is assumed.
- Objects: programs, program members, profiles, players, camps, enrollments, import receipts, goals, issue reports.
- All IDs are stable source IDs scoped to the program. One registration ID corresponds to one player in one camp.
- Amounts are integer cents; user-facing CSV Amount Paid values are decimal USD.
- A camp can have many registrations and dates covering multiple all-day calendar cells.
- Confirmed enrollment count excludes cancelled and waitlisted registrations.
- New players are unique participant IDs first seen in confirmed enrollment history by camp start year.
- Schools and districts are registration snapshots, not current player-profile values.
- Demo data spans five years (2022–2026), with repeat IDs, cancellations, waitlists, three camp types, six schools, and referral sources.
- The overview answers: how is this camp year doing relative to the last and its goal?
- Every total and distribution derives from the same rows. Missing years display zero; missing source/demographic values display Unknown.

## Backend boundary

The basic backend is Supabase Auth + PostgreSQL + the Data API. The browser uses only a public publishable key with the user's access token. No service-role credential belongs in Vite environment variables.

Database RLS limits records to explicitly provisioned program memberships. Staff cannot grant themselves membership. The import RPC uses SECURITY DEFINER with an empty search_path, explicit authenticated membership checks, qualified tables, validation, and a transaction lock per program. All its writes roll back together. Repeated file hashes are idempotent; existing registration IDs are updated, not appended. A registration ID cannot be reassigned to another camp or player. Import batches are capped at 5,000 records.

This is an upsert importer, not a deletion sync. Registrations omitted from subsequent files remain in the database; cancellation must be explicit. The original raw CSV is not retained, avoiding storage of unrelated export columns. Only mapped fields are stored. The import history retains filename, SHA-256 hash, importer, timestamp, and processed row count.

Live datasets are not stored in localStorage. Demo state stays in memory and clears on page reload/sign-out. Demo issue submission does not contact support. Live reports are stored in the issues table for administrators, without automatically sending messages.

No real Teamworks export has been supplied. Column aliases and sample format are placeholders; the mapping UI must be validated against the first real export before production use. The project has no live Supabase credentials yet, so the deployment opens in demo-capable mode.
