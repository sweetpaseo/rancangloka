# RancangLoka Context

## Produk

RancangLoka adalah portal/media informasi arsitektur dan hunian untuk pembaca umum Indonesia:
- rumah,
- gedung,
- ruko,
- kantor,
- apartemen,
- material,
- problem solving,
- komparasi material,
- editorial review.

Website menggunakan Astro + Cloudflare dengan content-first architecture, target performa sangat tinggi, dan JavaScript minimal.

## Editorial positioning

> Media arsitektur dan hunian yang berbicara dengan bahasa orang rumah, tetapi berpikir seperti editor yang paham teknis.

RancangLoka tidak menulis untuk membuat pembaca merasa sedang membaca buku kuliah.

Gunakan bahasa teknis untuk menjelaskan teknis. Gunakan bahasa manusia untuk menjelaskan kehidupan sehari-hari.

## Signature article logic

Hook masalah nyata
→ diagnosis/konteks
→ evaluasi solusi
→ cara kerja seperlunya
→ kelebihan relevan
→ keterbatasan/risiko
→ alternatif
→ kriteria keputusan
→ verdict bernuansa

Format utama:
- Review + Problem Solving
- Problem Solving
- Critical Review
- Comparison

## Production goal

Prioritas saat ini:
1. kualitas artikel,
2. biaya rendah,
3. workflow sederhana,
4. automation bertahap,
5. evidence proporsional terhadap risiko,
6. image generation hybrid manual + AI,
7. publish lewat Astro/Git/Cloudflare.

## Orchestrator

Pilihan produksi saat ini: **Hermes-first**.

Hermes bukan pengganti code deterministic. Hermes adalah orchestrator/editorial workflow brain.

## Model decisions dari AI Lab

- Model-only Topic Hunter: GPT-5.6 Luna
- Editorial Planner: GPT-5.6 Luna
- Writer: GPT-5.6 Luna
- QA capability: GPT-5.6 Luna
- Targeted repair: GPT-5.6 Luna
- Independent Evidence Critic: Qwen 3.8 bila perlu
- Search: optional capability, bukan core editorial brain

Prinsip:
> Luna-first, bukan Luna-only.

## Tahap sekarang

1. audit repo Astro aktual,
2. lock Astro Article Contract,
3. setup Hermes,
4. dry-run artikel ke file,
5. validate ke Astro,
6. Git/Cloudflare integration,
7. scheduler/autonomous mode terakhir.
