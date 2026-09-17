# Astro Article Contract v1 — Draft

**Important:** ini adalah kontrak target, bukan asumsi bahwa repo Astro saat ini sudah memakai field/path yang sama.

Coding agent harus audit Astro project lebih dulu dan menyesuaikan kontrak ini sebelum implementasi.

## Target responsibilities

Setiap artikel harus memiliki:
- unique slug,
- title,
- description,
- category,
- publication state/date,
- SEO fields,
- cover/image metadata bila ada,
- risk/evidence metadata,
- body Markdown/MDX valid,
- no unresolved placeholders.

## Candidate frontmatter

```yaml
---
title: ""
slug: ""
description: ""

category: ""
tags: []

status: draft
publishedAt:
updatedAt:

riskLevel: low
evidenceMode: none

seoTitle: ""
seoDescription: ""

cover:
coverAlt:

author: "RancangLoka Editorial Desk"

relatedArticles: []
relatedMaterials: []
relatedProblems: []
---
```

Field final harus mengikuti content collection/schema aktual setelah audit.

## Publication states

Suggested:
- idea
- planned
- draft
- qa
- approved
- scheduled
- published
- rejected

Astro content file kemungkinan hanya membutuhkan subset, sementara workflow state lengkap dapat disimpan di Topic/Content DB.

## Risk values

- low
- medium
- high
- current

`current` digunakan bila kebenaran bergantung informasi terbaru seperti harga, regulasi, produk, trend, data pasar.

## Evidence mode

- none
- selective
- strict

## Body contract

Artikel tidak harus memakai heading identik, namun biasanya mengikuti:

```markdown
# Judul

Opening / masalah nyata

## Diagnosis atau konteks

## Solusi / pilihan yang dinilai

## Kelebihan yang relevan

## Keterbatasan atau risiko

## Alternatif

## Kriteria keputusan

## Verdict RancangLoka
```

## Deterministic publish gate

Sebelum `published`:
- title ada
- slug valid dan unique
- description ada
- publish date valid
- category valid
- Markdown/MDX parse valid
- frontmatter/schema valid
- tidak ada `[EVIDENCE NEEDED]`
- tidak ada `TODO`
- tidak ada placeholder internal
- cover path valid jika cover dipakai
- cover alt ada jika cover dipakai
- internal links valid
- tidak ada duplicate slug
- artikel melewati risk/evidence policy
- `astro build` PASS

## Handoff goal

Hermes dianggap berhasil jika mampu menghasilkan file artikel yang:
1. valid terhadap schema,
2. dapat masuk ke content directory,
3. membuat `astro build` tetap hijau,
4. tidak memerlukan edit manual untuk memperbaiki format teknis.
