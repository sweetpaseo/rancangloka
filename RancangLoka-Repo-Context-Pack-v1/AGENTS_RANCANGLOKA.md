# AGENTS.md — RancangLoka

Dokumen ini wajib dibaca sebelum coding agent melakukan perubahan pada repo.

## Mode awal: READ-ONLY AUDIT

Jika ini pertama kali agent membuka repo:
1. baca seluruh `/docs`,
2. audit struktur project Astro aktual,
3. petakan content collections, routes, components, image pipeline, SEO, build, Cloudflare, dan Git,
4. **jangan mengedit file apa pun** sebelum menghasilkan implementation plan.

Jangan mengasumsikan struktur Astro dari dokumen ini jika repo aktual berbeda. Repo aktual adalah sumber teknis final; `/docs` adalah sumber arah produk/editorial.

## Tujuan sistem

Topic Queue
→ GPT-5.6 Luna Planner
→ Risk Router
→ optional Evidence
→ GPT-5.6 Luna Writer
→ QA
→ deterministic publication gate
→ image decision
→ Markdown/MDX
→ Git
→ Astro
→ Cloudflare

Hermes direncanakan sebagai orchestrator utama.

## Pembagian tanggung jawab

### AI / agent
Gunakan untuk:
- topic ideation,
- editorial planning,
- risk classification,
- article writing,
- diagnosis problem/solution,
- selective evidence analysis,
- editorial QA,
- image direction.

### Deterministic code
Gunakan untuk:
- slug,
- schema validation,
- duplicate/cannibalization checks,
- word count,
- frontmatter validation,
- Markdown/MDX validation,
- internal-link validation,
- source URL validation,
- budget caps,
- retry limits,
- file creation,
- Git operations,
- build checks.

Jangan memakai LLM untuk tugas yang bisa divalidasi code secara pasti.

## Model policy

Default:
- Editorial brain: GPT-5.6 Luna via SumoPod.
- Independent evidence critic: Qwen 3.8 hanya bila dibutuhkan.
- Search/retrieval: optional, bukan dependency default.
- Jangan menambah model baru tanpa alasan produksi yang jelas.

## Evidence policy

Evidence tidak wajib penuh untuk semua artikel.

Risk router:
- LOW: tidak perlu live research secara default.
- MEDIUM: evidence selektif hanya untuk technical/quantitative/current claims.
- HIGH: evidence kuat wajib + independent verification.
- CURRENT: live search wajib untuk harga, regulasi, produk terbaru, tren, data waktu-sensitif.

## Image policy

Hybrid manual + AI. Jangan memaksa 4 gambar AI per artikel.

- Pillar: cover + contextual images bila bernilai.
- Comparison/problem solver: cover + diagram/contextual image bila perlu.
- Regular evergreen: cover saja atau manual.
- Diagram sederhana: SVG/HTML/code bila memungkinkan.

## Jangan lakukan ini

- Jangan langsung mengintegrasikan Hermes sebelum Article Contract Astro dikunci.
- Jangan mengubah framework Astro.
- Jangan memasukkan seluruh AI Lab/benchmark ke production.
- Jangan membuat multi-model orchestration tanpa kebutuhan.
- Jangan auto-publish sebelum validator + build gate stabil.
- Jangan menyimpan API key di repo.
- Jangan melakukan destructive Git operation tanpa persetujuan.
