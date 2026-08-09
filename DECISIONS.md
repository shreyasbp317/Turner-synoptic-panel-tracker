# Decisions

Assumptions and choices made where the build prompt left room for judgment.

## Confirmed product choices (from stakeholder)

1. **TWMS is a separate system** under each building (with Data Hall zones), in addition to MES-FCM, HAC, Electrical Yard, and Mechanical Yard.
2. **Tags are preferred from the source file** when present (`dataMapping.areas` in `.jsvg`, or non-generic SVG `id` / `data-equipment-tag`). The admin mapping screen + CSV bulk map remain available for unmapped shapes (the sample Synoptic `.jsvg` had empty `areas`, so mapping/CSV is still required for that file).
3. **Status sets** match the prompt exactly (`full_delivery_install`, `hac_delivery_install`, `yard_status`) with the specified hex colors.

## Stack

- **Next.js App Router + TypeScript** for UI and API routes (single deployable app).
- **Prisma 6 + PostgreSQL** for schema/migrations (not Prisma 7, to avoid the new driver-adapter setup friction for local install).
- **Embedded PostgreSQL** (`embedded-postgres` on port `54329`) for local development because the machine’s installed Postgres instances require an unknown password. Production should set `DATABASE_URL` to a real managed Postgres.
- **iron-session** cookie sessions for auth; `AuthProvider` interface allows swapping to Azure AD/Entra later.
- **Local disk file storage** behind `FileStorage` interface for Azure Blob / S3 swap later.
- **Recharts** for overview donut charts.
- **fast-xml-parser** for plain SVG parsing; JSON parse for `.jsvg`.

## Hierarchy / UI

- Building names are stored as `RPL 1`, `RPL 2`, … and displayed as `RPL-1`, `RPL-2` in headers/tabs to match the existing Power BI labels.
- Zone tabs render only for MES-FCM / TWMS / HAC and use labels like `RPL-1 Data Hall "A"`.
- MES-FCM seed `display_name` is `MES, TWMS, & FCMs` to match the familiar combined Power BI header even though TWMS also exists as its own navigable system (for TWMS-only plans).
- Overview charts group equipment by `equipmentType`, then `layer`, else a single `Overview` group — this mirrors the FCM/MES/TWMS multi-donut layout when those fields are populated from CSV/mapping.

## Upload / mapping / status

- Replacing an active floor plan for the same zone/system deactivates the previous plan, carries mappings/status/history forward by `shape_key`, and reports new/missing keys.
- New equipment defaults to the StatusSet’s `is_default` option (Pending Delivery `#F0E098`) and gets an initial history row.
- Status changes are transactional (equipment update + history + floor plan `last_refresh_at`). UI reverts color if the API fails.
- CSV mapping requires an `Equipment Tag` column; optional `shape_key` preferred, otherwise row-order match after sorting shapes top-to-bottom then left-to-right (`y`, then `x`), with a preview before commit.

## Export

- File export rewrites fill colors on matching shape ids and also appends a status overlay group for fidelity.
- For `.jsvg`, `dataMapping.areas` is populated with tag/name/status/color per rect key.
- CSV history uses Bluebeam-style pipe-delimited segments, oldest → newest:  
  `<Status>_ set by <user> on <M/d/yyyy> at <h:mm:ss a>|...`

## Auth / roles

- Invite-only access: every invited user has full app access (upload, status, mapping, export, users). EDITOR/VIEWER labels are no longer used in the UI.
- Floor plan backgrounds are served from `/api/floor-plans/[id]/background` and fetched client-side so multi‑MB Synoptic SVGs are not inlined into page HTML.
- **Hosting target:** Oracle Cloud Always Free (Docker Compose; see `DEPLOY-ORACLE.md`). Railway remains available as a paid alternative (`DEPLOY-RAILWAY.md`).

## Out of scope for v1 (interfaces ready)

- Azure AD / Entra SSO (auth provider swap).
- Azure Blob / S3 storage (storage interface swap).
- Real-time multi-user sync beyond refresh-after-write (status updates persist and reload correctly).
