# 🗄️ Cloudflare D1 Forward-Only Database Migrations

This directory contains tracked, forward-only SQL migrations for the RancangLoka Cloudflare D1 database (`rancangloka_db`).

---

## 📋 Conventions & Rules

1. **Forward-Only Migrations:**
   - Never rewrite or modify previously applied migration files.
   - Never drop or truncate existing production tables without explicit migration plans.
   - Never renumber or overwrite existing primary keys (`id`) or foreign key relationships.
2. **File Naming Format:**
   ```text
   <4-digit-sequence>_<descriptive_snake_case_name>.sql
   ```
   Example:
   - `0001_category_taxonomy_expansion.sql`
   - `0002_add_ingest_receipts.sql`
3. **Tracking Mechanism:**
   Cloudflare Wrangler tracks applied migrations in the D1 database table `d1_migrations`. When migrations are executed via Wrangler, each migration is recorded with its name and application timestamp to ensure it is applied exactly once.

---

## 🛠️ Local Bootstrap and Migration Commands

### Fresh Local D1 Bootstrap

Create or refresh a local D1 database from an empty Miniflare state:

```bash
npm run db:local:bootstrap
```

This is the canonical local bootstrap command. It is local-only, uses the root
`wrangler.toml`, and never contacts remote production D1.

`db/schema.sql` is the baseline schema snapshot for the original runtime tables
and seed rows. It is executable only through the bootstrap command, not directly
followed by all historical migrations. Some historical migrations overlap that
baseline because they were written for already-existing production tables.

The bootstrap command therefore:

1. Applies `db/schema.sql`.
2. Replays only non-overlapping historical migrations required for current
   subsystems.
3. Initializes `d1_migrations` through the current local baseline so Wrangler
   will not replay overlapping historical migrations.

The command is safe to rerun on an already-current local D1 because all executed
DDL uses `IF NOT EXISTS` and seed/journal rows use `INSERT OR IGNORE`.

### Local Astro Worker Runtime

The Astro 7 production-like Worker is launched from `dist/server/wrangler.json`
through the short-drive wrapper in `scripts/dev-worker-local.mjs`. That generated
Worker config has its own local Miniflare D1 state. After a fresh build or empty
local Worker state, initialize it with the same bootstrap contract before route
validation:

```bash
npm run worker:local:bootstrap
npm run worker:local
```

This is also local-only. It targets the generated Worker config and does not run
remote migrations or mutate production D1.

`npm run worker:local` does not migrate automatically. It expects the generated
Worker D1 state to have been bootstrapped already.

### Applying Future Local Migrations

After the local bootstrap baseline exists, apply future pending migrations to the
root local test database with:

```bash
npx wrangler d1 migrations apply DB --local
```

List migration status locally:

```bash
npx wrangler d1 migrations list DB --local
```

### Remote Production (CAUTION: Authorized Deployment Only)

> ⚠️ **IMPORTANT:** Never execute remote migrations without an approved Phase plan and backup.

Check migration status on remote production:

```bash
npx wrangler d1 migrations list DB --remote
```

Apply pending migrations to remote production:

```bash
npx wrangler d1 migrations apply DB --remote
```

---

## ⏪ Rollback Limitations

Cloudflare D1 uses serverless SQLite and does not support automated down/rollback scripts.
If a migration needs to be reversed or amended:
1. Do **not** delete the existing migration file.
2. Author a **new forward migration** (e.g. `0002_revert_...sql`) that applies the corrective schema alterations.
3. Test locally first with `--local` before applying to production.
