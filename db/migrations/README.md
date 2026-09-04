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

## 🛠️ Migration Commands

### Local Environment (Wrangler / Miniflare)

Apply pending migrations to the local test database:

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
