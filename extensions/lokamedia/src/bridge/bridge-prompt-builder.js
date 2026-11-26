/**
 * LokaBridge Studio — Dynamic Prompt Builder
 * File: extensions/lokamedia/src/bridge/bridge-prompt-builder.js
 *
 * Assembles hierarchical, modular, versioned prompts for ChatGPT Plus and Gemini Advanced.
 * Enforces Conversational Editorial 2.1, Golden Article #9993, and strict JSON output schema.
 */

export const PROMPT_VERSION = '1.1.0';

export function buildArticlePrompt({
  topic = '',
  focusKeyword = '',
  secondaryKeywords = [],
  angle = 'Problem Solving',
  customAngleNotes = '',
  referenceUrls = [],
  referenceText = '',
  targetAudience = 'Pemilik rumah tinggal tropis di Indonesia',
  category = 'Material & Struktur',
  productionId = `prod_${Date.now()}`
} = {}) {
  const refUrlsFormatted = referenceUrls.filter(Boolean).map(u => `- ${u}`).join('\n') || '(Tidak ada URL referensi langsung)';
  const refTextFormatted = referenceText.trim() ? `\n--- CATATAN MATERI REFERENSI ---\n${referenceText.trim()}\n--------------------------------` : '';

  return `Kamu adalah Redaktur Senior & Konsultan Konstruksi Rumah Tinggal untuk Media Digital Arsitektur "RancangLoka" (rancangloka.com).

TUGAS UTAMA:
Tulis artikel panduan arsitektur/hunian mendalam, ramah, dan sangat praktis berdasarkan brief redaksi di bawah ini.
Hasil WAJIB dikembalikan DALAM BENTUK SATU BLOK KODE JSON TUNGGAL (\`\`\`json ... \`\`\`) yang valid dan memuat seluruh naskah Markdown beserta metadata editorial terstruktur.

=======================================================
1. BRIEF EDITORIAL & INTENT
=======================================================
- Topik / Pertanyaan Pembaca : "${topic || focusKeyword}"
- Focus Keyword (Primer)     : "${focusKeyword}"
${secondaryKeywords.length ? `- Secondary Keywords        : ${secondaryKeywords.join(', ')}` : ''}
- Sudut Pandang (Angle)      : ${angle}${customAngleNotes ? ` (${customAngleNotes})` : ''}
- Target Pembaca             : ${targetAudience}
- Kategori Rubrik            : ${category}
- Production ID              : ${productionId}

REFERENSI PENELITIAN:
${refUrlsFormatted}
${refTextFormatted}

=======================================================
2. ATURAN WAJIB RANCANGLOKA EDITORIAL DNA (NON-NEGOTIABLE)
=======================================================
1. GAYA BAHASA (Conversational Editorial 2.1):
   - Gunakan bahasa Indonesia percakapan yang hangat, bersahaja, lugas, dan mengalir alami khas konsultan ramah ("Jakarta Editorial").
   - Wajib gunakan sapaan akrab "kamu" atau "rumahmu" di dalam naskah. DILARANG menggunakan kata kaku "Anda".
   - Hindari kata klise AI (anti-slop): Dilarang menulis "Di era modern ini", "Tidak dapat dipungkiri", "Tentunya", "Memukau", "Menyelami", "Simfoni estetika".
   - Satu ide pokok per paragraf (30–65 kata per paragraf, maksimal 3 kalimat). Dilarang menyajikan dinding teks (wall-of-text).

2. PENEMPATAN KATA KUNCI (Aturan Kanonikal ED-SEO-01):
   - Focus keyword ("${focusKeyword}") WAJIB muncul secara mengalir dan alami pada KALIMAT PERTAMA paragraf pembuka artikel.
   - Focus keyword ("${focusKeyword}") WAJIB muncul kembali secara alami pada KALIMAT TERAKHIR paragraf penutup artikel.

3. KELENGKAPAN & STRUKTUR NASKAH:
   - Panjang naskah minimal 750 kata (disarankan 800–1.200 kata).
   - Minimal 3 subbab utama menggunakan heading H2 (## 1. ..., ## 2. ..., ## 3. ...).
   - Jawaban langsung (Answer-First): Kalimat pertama setiap subbab wajib langsung menjawab pertanyaan subbab tersebut tanpa basa-basi berbelit.

4. KEBIJAKAN BUKTI (EVIDENCE-FIRST & MONETARY SILENCE):
   - Dilarang mengarang klaim teknis, statistik lab fiktif, atau nomor standar SNI palsu.
   - Jangan melempar angka estimasi biaya acak tanpa rincian empiris yang bisa dipertanggungjawabkan.

5. RENCANA VISUAL & PENEMPATAN GAMBAR (OBJECT-FIRST):
   - Siapkan 1 Cover Hero (rasio 1315x660) dan minimal 2 gambar inline (rasio 16:9).
   - Tentukan penempatan anchor pada naskah untuk masing-masing gambar inline.
   - Berikan prompt gambar fotorealistik kontekstual arsitektur rumah tinggal tropis Indonesia (pencahayaan alami, material nyata semen/kayu/bata/cat doff, tanpa teks/watermark).

=======================================================
3. FORMAT KONTRAK OUTPUT JSON (STRICT SCHEMA)
=======================================================
KEMBALIKAN HANYA SATU BLOK JSON DENGAN STRUKTUR BERIKUT:

\`\`\`json
{
  "schema_version": "1.0.0",
  "production_id": "${productionId}",
  "title": "Judul Artikel Menarik dan Solutif (40–65 Karakter)",
  "slug": "slug-artikel-ramah-seo",
  "focus_keyword": "${focusKeyword}",
  "secondary_keywords": ["kata kunci pendukung 1", "kata kunci pendukung 2"],
  "search_intent": "informational",
  "editorial_angle": "${angle}",
  "custom_angle_notes": "${customAngleNotes.replace(/"/g, '\\"')}",
  "description": "Deskripsi meta singkat dan persuasif untuk Google Search (120–155 karakter).",
  "seo_title": "Judul Khusus SEO (Wajib 40–65 Karakter)",
  "category_id": 8,
  "tags": ["Plafon", "Interior", "Material"],
  "key_takeaways": [
    "Poin penting 1 yang praktis",
    "Poin penting 2 yang teknis",
    "Poin penting 3 untuk pencegahan masalah"
  ],
  "faq": [
    {
      "question": "Pertanyaan praktis yang sering diajukan pembaca?",
      "answer": "Jawaban lugas dan langsung ke solusi dalam 2-3 kalimat."
    }
  ],
  "references": [
    {
      "title": "Sumber referensi atau panduan teknis yang relevan",
      "url": "https://example.com/panduan",
      "notes": "Acuan standar sambungan dan kompon"
    }
  ],
  "visual_slots": [
    {
      "visual_id": "cover_hero",
      "role": "cover_hero",
      "target_dimensions": "1315x660",
      "alt_text": "Deskripsi visual akurat untuk aksesibilitas dan SEO",
      "caption": "Keterangan foto penjelas untuk pembaca",
      "generation_prompt": "Prompt detail untuk image generator (fotorealistik, interior rumah tropis modern, pencahayaan alami warm white, sambungan rapi, lensa 35mm, f/4, natural daylight)",
      "is_approved": false
    },
    {
      "visual_id": "inline_1",
      "role": "inline",
      "placement_anchor": "## 1. Subbab Pertama Tempat Gambar Ditampilkan",
      "target_dimensions": "16:9",
      "alt_text": "Deskripsi visual inline 1",
      "caption": "Keterangan teknis gambar inline 1",
      "generation_prompt": "Prompt fotorealistik untuk visual penjelas subbab 1",
      "is_approved": false
    },
    {
      "visual_id": "inline_2",
      "role": "inline",
      "placement_anchor": "## 2. Subbab Kedua Tempat Gambar Ditampilkan",
      "target_dimensions": "16:9",
      "alt_text": "Deskripsi visual inline 2",
      "caption": "Keterangan teknis gambar inline 2",
      "generation_prompt": "Prompt fotorealistik untuk visual penjelas subbab 2",
      "is_approved": false
    }
  ],
  "content_md": "# Judul Artikel\\n\\nKalimat pertama pembuka wajib memuat ${focusKeyword} secara alami...\\n\\nParagraf kedua...\\n\\n## 1. Subbab Pertama\\n\\nIsi subbab...\\n\\n## 2. Subbab Kedua\\n\\nIsi subbab...\\n\\n## 3. Subbab Ketiga\\n\\nIsi subbab...\\n\\nParagraf penutup dengan kalimat terakhir yang memuat ${focusKeyword} secara alami.",
  "external_source": {
    "platform": "chatgpt_plus",
    "model": "gpt-4o",
    "captured_at": "${new Date().toISOString()}"
  }
}
\`\`\``;
}

export function buildVisualPrompt(slot) {
  const isCover = slot.role === 'cover_hero';
  const aspectDesc = isCover ? 'Aspect Ratio 2:1 (~1315x660px panorama)' : 'Aspect Ratio 16:9 widescreen';

  return `Realistic architectural photography, authentic Indonesian modern tropical home, ${slot.generation_prompt || slot.alt_text || 'architectural detail'}. Clean composition, real textures of plaster, concrete, natural daylight diffused from windows, crisp shadow details, shot on 35mm lens, f/5.6, editorial magazine photography style, warm neutral tones. NO 3D CGI cartoon look, NO deformed objects, NO text, NO watermark. ${aspectDesc}.`;
}

export function buildSmartRepairPrompt(failedChecks = [], missingFields = [], currentJson = {}) {
  const problemsList = [
    ...missingFields.map(f => `- Field '${f}' hilang atau kosong`),
    ...failedChecks.map(c => `- ${c}`)
  ].join('\n');

  return `Sebagai Redaktur Senior RancangLoka, perbaiki HANYA bagian yang tidak memenuhi standar pada paket editorial JSON berikut tanpa mengubah bagian yang sudah baik:

MASALAH YANG PERLU DIPERBAIKI:
${problemsList}

INSTRUKSI PERBAIKAN:
1. Pastikan panjang judul tetap 40–65 karakter.
2. Pastikan focus keyword "${currentJson.focus_keyword || ''}" tertulis secara alami di kalimat pertama dan kalimat terakhir naskah.
3. Kembalikan paket JSON lengkap yang sudah diperbaiki dalam blok kode \`\`\`json ... \`\`\`.`;
}
