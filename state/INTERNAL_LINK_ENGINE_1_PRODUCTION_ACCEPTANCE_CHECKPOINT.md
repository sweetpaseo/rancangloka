# 🧭 RancangLoka & Hermes — Production Acceptance Checkpoint (INTERNAL-LINK-ENGINE-1)

**Tanggal:** 2026-10-15T14:35:00+07:00  
**Status Operasional:** `INTERNAL_LINK_ENGINE_1_PRODUCTION_ACCEPTED`  
**Branch Aktif:** `feat/jev-lokamedia-integration`  
**Otorisasi:** Chief Editor Explicit Authorization (`AUTHORIZE INTERNAL_LINK_ENGINE_1 PRODUCTION ACCEPTANCE`)

---

## 1. Production Migration Truth
- **Database:** `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`)
- **Migration Applied:** `0033_internal_link_engine.sql`
- **Schema Verified:**
  - Table: `article_internal_links` (13 columns, primary unique index on `(source_article_id, target_article_id, placement_plane)`)
  - Columns Added to `articles`: `pillar_role` (default `'STANDALONE'`), `parent_pillar_id` (default `NULL`)
  - Indexes: `idx_internal_links_source`, `idx_internal_links_target`, `idx_internal_links_source_plane`

---

## 2. Worker Deployment Truth
- **Previous Deployment ID:** `bc828313-97ca-4b6e-a0b7-630447b4e279`
- **Active Deployment ID:** `d81c7b65-eee6-468d-b517-36d6ac77dcf6`
- **Startup Time:** 12 ms
- **Triggers:** 4 active cron schedules

---

## 3. Seeded Semantic Relationships (Plane A Only)
- Total Rows: Exactly 5
- Status: `ACTIVE`
- Placement Plane: `PLANE_A_DYNAMIC`
- Reviewer: `Chief Editor`
- Edges:
  1. `9 -> 8`: `RELATED_MATERIAL`
  2. `8 -> 9`: `RELATED_DECISION`
  3. `8 -> 7`: `RELATED_PROBLEM`
  4. `7 -> 8`: `BACKGROUND_EXPLAINER`
  5. `7 -> 9`: `RELATED_SYSTEM`
- Plane B Rows: Exactly 0
- Non-Canonical Relationships: Exactly 0

---

## 4. Article Hash & Content Invariants
- **Article A (id: 7):** `00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298` (Unchanged)
- **Article B (id: 8):** `66094cf52d2d10650b82141adace0cedc27fc9a3f63ae1f85e19a57c38d4e260` (Unchanged)
- **Article C (id: 9):** `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28` (Unchanged)
- Zero mutation of published prose, zero stored inline anchors.

---

## 5. Public Presentation & Deduplication Verified Live
- `https://rancangloka.com/jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge`: HTTP 200, renders Article B & C with reader reasons.
- `https://rancangloka.com/thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi`: HTTP 200, renders Article C & A with reader reasons.
- `https://rancangloka.com/memilih-sistem-shading-luar-rumah-tropis`: HTTP 200, renders Article B with reader reason.
- Surface deduplication: Zero duplicate destination cards across Plane A, BACA JUGA, and footer RelatedArticles.

---

## 6. Rollback Readiness
- Pre-mutation snapshot: `state/PRE_MIGRATION_0033_RECOVERY_RECORD.json`
- Rollback target for Worker: `bc828313-97ca-4b6e-a0b7-630447b4e279`
- Rollback target for graph: `DELETE FROM article_internal_links WHERE id IN (1, 2, 3, 4, 5);`
