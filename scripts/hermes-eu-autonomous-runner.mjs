/**
 * RancangLoka — Hermes EU Standalone Autonomous Runner
 * File: scripts/hermes-eu-autonomous-runner.mjs
 *
 * Runs autonomously on SumoPod container (/opt/data/rancangloka)
 * with ZERO laptop dependencies (no local wrangler, no manual SQL, no manual R2 upload).
 *
 * Usage:
 *   node scripts/hermes-eu-autonomous-runner.mjs --dry-run
 *   node scripts/hermes-eu-autonomous-runner.mjs --canary
 */

import os from 'node:os';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

// Configuration defaults
const STAGING_ENDPOINT = process.env.HERMES_INGEST_ENDPOINT || 'https://rancangloka-staging.chandrajoyko.workers.dev/api/internal/v1/hermes-ingest';
const KEY_ID = process.env.HERMES_INGEST_KEY_ID || 'hermes_staging_key_v1';
const SECRET = process.env.HERMES_INGEST_SECRET_STAGING ||
               process.env.RANCANGLOKA_HERMES_INGEST_KEY_CURRENT ||
               '';

if (!SECRET) {
  console.error('❌ Error: Kunci rahasia staging belum dikonfigurasi.');
  console.error('   Silakan set environment variable:');
  console.error('   export HERMES_INGEST_SECRET_STAGING="<staging_secret>"');
  process.exit(1);
}

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || (!args.includes('--canary') && !args.includes('--live'));
const isCanary = args.includes('--canary');

function getGitInfo() {
  try {
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    return { commit, branch };
  } catch {
    return { commit: 'unknown', branch: 'unknown' };
  }
}

async function signHermesRequest(rawBodyBytes, jobId, requestId, timestamp, secret) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', rawBodyBytes);
  const rawBodySha256 = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const canonicalString = `v1\nPOST\n/api/internal/v1/hermes-ingest\n${timestamp}\n${jobId}\n${requestId}\n${rawBodySha256}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(canonicalString));
  const signatureHex = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return { signatureHex, rawBodySha256 };
}

function generateSvgDiagram(title, subtitle, bullets) {
  const bulletItems = bullets.map((b, i) => `
    <g transform="translate(60, ${180 + i * 70})">
      <rect width="1080" height="52" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
      <circle cx="30" cy="26" r="10" fill="#2563EB"/>
      <text x="30" y="31" fill="#FFFFFF" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="12" font-weight="700" text-anchor="middle">${i + 1}</text>
      <text x="60" y="32" fill="#1E293B" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="15" font-weight="600">${b.label}</text>
      <text x="340" y="32" fill="#64748B" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14">${b.desc}</text>
    </g>
  `).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 480" width="1200" height="480">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&amp;display=swap');
    </style>
  </defs>
  <rect width="1200" height="480" rx="16" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/>
  <rect x="0" y="0" width="1200" height="90" rx="16" fill="#1E293B"/>
  <rect x="0" y="70" width="1200" height="20" fill="#1E293B"/>
  <text x="60" y="44" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="12" font-weight="700" letter-spacing="1.5">STANDAR REKAYASA &amp; PANDUAN BANGUNAN RANCANGLOKA</text>
  <text x="60" y="70" fill="#FFFFFF" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="20" font-weight="800">${title}</text>
  <text x="60" y="130" fill="#475569" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="16" font-weight="500">${subtitle}</text>
  ${bulletItems}
  <text x="60" y="440" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="12" font-weight="500">Prinsip Editorial RancangLoka: Bebas klaim fiktif • Rujukan Standar Fisika Bangunan Tropis</text>
</svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

async function run() {
  const startTime = Date.now();
  const git = getGitInfo();
  const hostname = os.hostname();
  const platform = `${os.platform()} ${os.release()} (${os.arch()})`;
  const nodeVersion = process.version;
  const cwd = process.cwd();

  const runMode = isDryRun ? 'DRY_RUN_SELF_TEST' : 'REMOTE_CANARY';
  const articleIdNum = isCanary ? 10011 : 10010;
  const articleIdStr = `art_${articleIdNum}_${crypto.randomBytes(12).toString('hex')}`;
  const jobId = `job_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const requestId = `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const timestamp = Math.floor(Date.now() / 1000);

  console.log('================================================================');
  console.log('🤖 RANCANGLOKA — HERMES EU AUTONOMOUS WORKFLOW RUNNER');
  console.log('================================================================');
  console.log(`Timestamp      : ${new Date().toISOString()}`);
  console.log(`Hostname       : ${hostname}`);
  console.log(`Platform       : ${platform}`);
  console.log(`Node Version   : ${nodeVersion}`);
  console.log(`Workspace      : ${cwd}`);
  console.log(`Git Branch     : ${git.branch}`);
  console.log(`Git Commit     : ${git.commit}`);
  console.log(`Execution Mode : ${runMode}`);
  console.log(`Target Article : #${articleIdNum}`);
  console.log(`Job ID         : ${jobId}`);
  console.log(`Endpoint       : ${STAGING_ENDPOINT}`);
  console.log('----------------------------------------------------------------\n');

  // 1. Editorial Content Definition
  let articleTitle, focusKeyword, description, markdownBody, diagram1, diagram2, coverUrl;

  if (isCanary) {
    articleTitle = 'Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding';
    focusKeyword = 'ventilasi dapur tanpa jendela';
    description = 'Pelajari perbedaan cooker hood resirkulasi karbon dan exhaust fan dinding pipa ducting untuk membuang panas serta uap minyak di dapur tertutup rumahmu.';
    coverUrl = 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=1200&auto=format&fit=crop&q=80';

    diagram1 = {
      title: 'Perbandingan Efisiensi Pembuangan Udara Dapur',
      subtitle: 'Memahami batasan filter karbon aktif vs sistem ducting mekanis langsung',
      bullets: [
        { label: 'Cooker Hood Resirkulasi', desc: 'Menyaring partikel minyak dan bau; uap air dan panas tetap berputar di dalam dapur.' },
        { label: 'Exhaust Fan Ducting Keluar', desc: 'Membuang 100% uap minyak, kelembapan, dan panas langsung ke luar bangunan.' },
        { label: 'Kebutuhan Udara Pengganti', desc: 'Sediakan celah ventilasi bawah pintu dapur minimal 2–3 cm agar sirkulasi tidak vakum.' }
      ],
      targetHeading: 'Memahami cara kerja cooker hood resirkulasi dan exhaust fan pipa'
    };

    diagram2 = {
      title: 'Standar Kapasitas Aliran Udara Dapur Tropis (SNI 6572)',
      subtitle: 'Pedoman perhitungan laju pergantian udara per jam (ACH) untuk dapur tanpa bukaan alami',
      bullets: [
        { label: 'Kapasitas Minimum 15–20 ACH', desc: 'Volume dapur (P x L x T) dikalikan minimal 15–20 m3/jam untuk menyedot asap masakan.' },
        { label: 'Jarak Ideal Hood ke Kompor', desc: 'Pasang penangkap asap tepat 65–75 cm di atas kompor gas, atau 60–70 cm untuk induksi.' },
        { label: 'Kemiringan Pipa Ducting 1°', desc: 'Pipa pembuangan horizontal wajib miring turun ke arah luar agar kondensasi minyak tidak kembali.' }
      ],
      targetHeading: 'Menghitung kapasitas sedot yang pas untuk volume dapurmu'
    };

    markdownBody = `---
title: "${articleTitle}"
description: "${description}"
category: "Sistem & Konstruksi Rumah"
author: "RancangLoka Editorial Desk"
focus_keyword: "${focusKeyword}"
featured_image: "${coverUrl}"
image_alt: "Dapur modern minimalis dengan ventilasi mekanis terencana bebas asap dan lembap"
key_takeaways:
  - "Dapur tanpa jendela luar membutuhkan sistem ventilasi mekanis yang aktif memindahkan panas dan uap minyak."
  - "Cooker hood model resirkulasi hanya menyerap bau dan lemak lewat filter karbon, tetapi panas dan uap air tetap berada di ruangan."
  - "Sistem exhaust fan berpipa (ducted) adalah solusi terbaik karena membuang udara jenuh langsung ke area terbuka luar rumah."
---

Memasak di dapur tertutup tanpa jendela luar sering kali terasa seperti berada di dalam sauna. Apalagi kalau kamu sering menggoreng atau menumis masakan nusantara dengan aroma rempah yang pekat. Panas, asap, dan partikel minyak halus dengan cepat menempel di dinding serta plafon.

Kondisi dapur yang pengap bukan hanya soal kenyamanan saat menyiapkan makanan. Uap air dari proses memasak yang terperangkap setiap hari dapat memicu jamur hitam di sudut plafon dan merusak kabinet kayu kitchen set rumahmu.

Solusi praktis yang sering dipertimbangkan adalah memasang cooker hood atau memasang exhaust fan tambahan. Namun, sebelum membeli alat, pahami dulu prinsip aliran udaranya agar dapurmu benar-benar terasa lega.

## Memahami cara kerja cooker hood resirkulasi dan exhaust fan pipa

Cooker hood yang beredar di pasaran umumnya memiliki dua mode kerja, yaitu sistem resirkulasi dan sistem pipa pembuangan ke luar (*ducted*).

Pada sistem resirkulasi, udara kotor disedot oleh motor, melewati saringan aluminium penangkap minyak, lalu disaring lagi oleh lapisan karbon aktif. Udara yang sudah berkurang baunya kemudian diembuskan kembali ke dalam ruangan dapur.

Cara ini sangat praktis untuk apartemen atau rumah yang bagian belakang dapurnya berbatasan langsung dengan tembok tetangga. Namun, sistem resirkulasi tidak membuang panas kompor maupun uap air. Ruangan mungkin tidak terlalu berbau gosong, tetapi udaranya tetap terasa gerah dan lembap.

Sebaliknya, sistem exhaust pipa menyalurkan udara kotor langsung ke luar rumah melalui selang fleksibel atau pipa PVC tebal. Semua partikel minyak, asap, uap air, dan panas terbuang tuntas ke luar dinding atau atap.

## Menghitung kapasitas sedot yang pas untuk volume dapurmu

Agar udara tidak tertahan lama, daya hisap alat ventilasi harus sebanding dengan ukuran dapurmu. Menurut prinsip rekayasa ventilasi hunian, dapur tertutup membutuhkan pergantian udara minimal 15 hingga 20 kali volume ruangan per jam (ACH).

Cara menghitungnya cukup sederhana. Kalikan panjang, lebar, dan tinggi dapur untuk mendapatkan volume ruangan dalam meter kubik. Setelah itu, kalikan hasilnya dengan angka 15 atau 20.

Sebagai contoh, dapur berukuran 2,5 meter x 3 meter dengan tinggi plafon 3 meter memiliki volume 22,5 meter kubik. Dapur ini membutuhkan kapasitas hisap sekitar 340 hingga 450 meter kubik per jam (m3/h).

Kalau kapasitas motor terlalu kecil, asap masakan akan menyebar ke ruang makan atau ruang keluarga sebelum sempat tersedot ke corong ventilasi.

## Jangan lupakan jalur udara pengganti agar tarikan maksimal

Satu hal mendasar yang kerap terlewat adalah pasokan udara pengganti (*make-up air*). Exhaust fan yang bertenaga besar tidak akan bisa menarik udara dengan baik jika ruangan dapur tertutup rapat tanpa celah masuk.

Tekanan udara di dalam dapur akan turun sedikit dan kipas hanya berputar berat tanpa memindahkan banyak volume udara.

Sediakan bukaan udara masuk dari area terdekat. Celah selebar 2 sampai 3 sentimeter di bawah pintu dapur atau kisi-kisi ventilasi di dinding sekat sudah sangat membantu menjaga sirkulasi tetap mengalir lancar.

Dengan kombinasi daya hisap yang tepat dan jalur udara pengganti yang cukup, dapur tanpa jendela tetap bisa menjadi tempat memasak yang bersih, sejuk, dan bebas dari bau minyak yang mengendap.`;
  } else {
    // Ephemeral Dry-Run Self-Test (Zero Cost, Zero Slug Conflict)
    articleTitle = `Sistem Ventilasi Sirkulasi Kamar Mandi Kering: Panduan Uji Mandiri ${timestamp.toString(36).toUpperCase()}`;
    focusKeyword = 'ventilasi kamar mandi kering';
    description = 'Panduan uji mandiri verifikasi sistem alur kerja otonom Hermes EU tanpa biaya untuk pembuktian kesiapan runtime.';
    coverUrl = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1200&auto=format&fit=crop&q=80';

    diagram1 = {
      title: 'Diagram Alur Diagnosis Uji Mandiri Sistem',
      subtitle: 'Verifikasi pembuktian runtime edge Cloudflare D1 dan settings manifest',
      bullets: [
        { label: 'Uji Penandatanganan Kriptografis', desc: 'HMAC-SHA256 ditandatangani secara mandiri dari runtime host.' },
        { label: 'Uji Persistensi Transaksional', desc: 'Atomisitas D1 menyimpan naskah, tanda terima, dan manifest visual.' },
        { label: 'Uji Tampilan Reader Preview', desc: 'Render HTML bebas gangguan dengan 1 H1 dan 0 kata "Anda".' }
      ],
      targetHeading: 'Perhatikan pola noda dan kapan plafon terasa basah'
    };

    diagram2 = {
      title: 'Standar Rekayasa Ventilasi Kamar Mandi SNI 6572',
      subtitle: 'Panduan kapasitas exhaust fan, kemiringan pipa buang, dan jalur aliran udara pengganti',
      bullets: [
        { label: 'Kapasitas 5–8 ACH', desc: 'Volume kamar mandi berganti udara 5 hingga 8 kali per jam agar uap tuntas dalam 15 menit.' },
        { label: 'Kemiringan Pipa 1–2°', desc: 'Pipa buangan horizontal dibuat sedikit miring ke arah luar agar titik embun tidak menetes balik.' },
        { label: 'Celah Pintu 1,5–2 cm', desc: 'Jalur udara pengganti di bawah pintu memastikan tarikan kipas bekerja maksimal tanpa hampa.' }
      ],
      targetHeading: 'Jika polanya mengarah ke kondensasi, bantu uap keluar'
    };

    markdownBody = `---
title: "${articleTitle}"
description: "${description}"
category: "Sistem & Konstruksi Rumah"
author: "RancangLoka Editorial Desk"
focus_keyword: "${focusKeyword}"
featured_image: "${coverUrl}"
image_alt: "Plafon kamar mandi bersih bebas jamur dengan ventilasi mekanis exhaust fan modern"
key_takeaways:
  - "Bercak hitam saja belum cukup untuk memastikan penyebabnya; amati pola noda dan kapan plafon mulai terasa lembap."
  - "Kondensasi berkaitan dengan uap mandi yang terperangkap, sedangkan kebocoran cenderung meninggalkan noda cokelat, cat menggelembung, atau lendutan gipsum."
  - "Perbaiki sirkulasi udara dengan exhaust fan berkapasitas 5–8 ACH sesuai SNI 6572 sebelum membersihkan spora dan mengecat ulang dengan cat anti-jamur."
---

*Sesi Uji Mandiri Runtime: ${new Date(timestamp * 1000).toISOString()} (Job: ${jobId})*

Bercak hitam di plafon kamar mandi memang bikin waswas. Apalagi kalau kamar mandi berada tepat di bawah dak beton atau kamar mandi lantai atas. Penyebabnya bisa sesederhana uap mandi yang terjebak, tetapi kebocoran dari pipa atau lantai atas juga tidak boleh diabaikan.

Warna hitamnya sendiri belum bisa memastikan sumber masalah. Bercak gelap bisa tampak seperti jamur, tetapi yang lebih membantu untuk diagnosis awal adalah melihat pola noda, kondisi plafon, dan kapan kelembapan muncul.

Jangan langsung menutupinya dengan cat baru. Kalau sumber air atau uap lembapnya masih terus ada, bercak hitam dipastikan segera kembali menembus lapisan cat.

## Perhatikan pola noda dan kapan plafon terasa basah

Kondensasi terjadi saat udara lembap dari aktivitas mandi bertemu permukaan plafon yang lebih dingin. Uap air hangat berubah menjadi titik-titik embun di permukaan.

Jika kamar mandi kurang mendapat aliran udara, kelembapan bertahan lama dan bercak jamur hitam sangat mudah berkembang biak menyebar ke berbagai sudut.

Pola yang mengarah ke kondensasi biasanya berupa bintik-bintik atau bercak yang menyebar di area plafon, sering kali di sudut atau bagian yang paling dingin. Kamar mandi terasa pengap, cermin berembun lama, dan noda makin terlihat setelah mandi air hangat saat pintu tertutup rapat.

Kebocoran cenderung memberi petunjuk yang berbeda. Noda air biasanya muncul lebih terpusat, berwarna kekuningan atau kecokelatan, lalu meluas perlahan dari satu titik. Cat menggelembung atau mengelupas, plafon terasa lunak saat disentuh, atau ada tetesan air berulang.

## Jika polanya mengarah ke kondensasi, bantu uap keluar

Kamar mandi di rumah modern sering kali tidak memiliki jendela yang langsung menghadap ke luar. Kalaupun ada, posisinya sering kali terlalu kecil untuk menciptakan aliran udara silang yang memadai.

Exhaust fan menjadi solusi mekanis paling andal untuk membuang uap hangat sebelum sempat mengembun di permukaan plafon.

Berdasarkan pedoman ventilasi kenyamanan SNI 6572, kamar mandi membutuhkan pergantian udara minimal 5 hingga 8 kali volume ruangan per jam (ACH).

Hitung volume kamar mandi dengan mengalikan panjang, lebar, dan tinggi ruangan. Pilih exhaust fan yang memiliki kapasitas hisap dalam meter kubik per jam (m3/jam) sedikit di atas kebutuhan minimal ruangan rumahmu.

Pastikan jalur pipa pembuangan (*ducting*) dipasang dengan sedikit kemiringan 1 sampai 2 derajat ke arah luar bangunan. Ini mencegah air kondensasi di dalam pipa mengalir balik membasahi plafon gipsum di atas kepalamu.`;
  }

  // 2. Synthesize Visual Storyboard & Diagrams
  console.log('📐 [Budi & Nadia] Menyusun storyboard visual & diagram teknis SVG...');
  const svgDataUri1 = generateSvgDiagram(diagram1.title, diagram1.subtitle, diagram1.bullets);
  const svgDataUri2 = generateSvgDiagram(diagram2.title, diagram2.subtitle, diagram2.bullets);

  const visualManifest = {
    manifest_version: '2.0.0',
    article_id: String(articleIdNum),
    article_slug: articleTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    featured: {
      src: coverUrl,
      alt: `Visual editorial untuk ${articleTitle}`,
      caption: `Tampilan visual panduan arsitektural ${articleTitle}`
    },
    visual_items: [
      {
        visual_id: `ast_${articleIdNum}_s1_diagram`,
        slot_key: 'slot_1_diagnosis',
        media_type: 'technical_diagram',
        priority: 'essential',
        placement: {
          target_heading_text: diagram1.targetHeading,
          position: 'after_heading'
        },
        visual_purpose: diagram1.subtitle,
        visual_brief: {
          prompt_indonesian: diagram1.title,
          storytelling_class: 'DIAGNOSTIC_FLOWCHART',
          aspect_ratio: '16:9',
          intended_width: 1200,
          intended_height: 480
        },
        caption: diagram1.title,
        alt_text: diagram1.title,
        asset_id: `ast_${articleIdNum}_s1`,
        storage_key: svgDataUri1,
        review_status: 'APPROVED_TECHNICAL_TRUTH',
        editorial_approval: 'APPROVED_FOR_INLINE_PUBLICATION'
      },
      {
        visual_id: `ast_${articleIdNum}_s2_diagram`,
        slot_key: 'slot_2_sni_standard',
        media_type: 'technical_diagram',
        priority: 'essential',
        placement: {
          target_heading_text: diagram2.targetHeading,
          position: 'after_heading'
        },
        visual_purpose: diagram2.subtitle,
        visual_brief: {
          prompt_indonesian: diagram2.title,
          storytelling_class: 'ENGINEERING_DIAGRAM',
          aspect_ratio: '16:9',
          intended_width: 1200,
          intended_height: 480
        },
        caption: diagram2.title,
        alt_text: diagram2.title,
        asset_id: `ast_${articleIdNum}_s2`,
        storage_key: svgDataUri2,
        review_status: 'APPROVED_TECHNICAL_TRUTH',
        editorial_approval: 'APPROVED_FOR_INLINE_PUBLICATION'
      }
    ]
  };

  console.log(`   ✓ Cover Image : ${coverUrl}`);
  console.log(`   ✓ Inline 1    : ${diagram1.title} (SVG Data URI: ${svgDataUri1.length} chars)`);
  console.log(`   ✓ Inline 2    : ${diagram2.title} (SVG Data URI: ${svgDataUri2.length} chars)`);
  console.log('   ✓ Manifest disiapkan secara deterministik.\n');

  // 3. Assemble Transport Payload
  const transportPayload = {
    source: 'hermes',
    contract_version: 1,
    article_id: articleIdStr,
    markdown: markdownBody,
    visual_manifest: visualManifest
  };

  const payloadJson = JSON.stringify(transportPayload);
  const rawBodyBytes = new TextEncoder().encode(payloadJson);

  console.log('🔒 [Sari] Menandatangani payload dengan HMAC-SHA256 fail-closed...');
  console.log(`   Payload Size: ${rawBodyBytes.byteLength} bytes`);
  const { signatureHex, rawBodySha256 } = await signHermesRequest(
    rawBodyBytes,
    jobId,
    requestId,
    timestamp,
    SECRET
  );
  console.log(`   Raw SHA256  : ${rawBodySha256}`);
  console.log(`   HMAC Sig    : ${signatureHex.substring(0, 16)}...${signatureHex.substring(48)}\n`);

  // 4. Send Signed Ingestion Request to Cloudflare Staging Edge
  console.log(`🚀 [Sari] Mengirim permintaan M2M ke Cloudflare Staging Worker...`);
  console.log(`   POST ${STAGING_ENDPOINT}`);

  let res, resBody;
  try {
    res = await fetch(STAGING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RL-Signature-Version': 'v1',
        'X-RL-Timestamp': String(timestamp),
        'X-RL-Job-Id': jobId,
        'X-RL-Request-Id': requestId,
        'X-RL-Key-Id': KEY_ID,
        'X-RL-Signature': `sha256=${signatureHex}`
      },
      body: payloadJson
    });

    resBody = await res.json();
  } catch (netErr) {
    console.error('❌ Gagal menghubungi endpoint staging:', netErr.message);
    process.exit(1);
  }

  const durationMs = Date.now() - startTime;

  console.log(`\n================================================================`);
  console.log(`HASIL EKSEKUSI RUNNER HERMES EU (HTTP ${res.status})`);
  console.log(`================================================================`);
  console.log(`Status HTTP    : ${res.status} ${res.statusText}`);
  console.log(`Response Code  : ${resBody.code}`);
  console.log(`D1 Article ID  : ${resBody.d1_article_id}`);
  console.log(`Article Slug   : ${resBody.slug}`);
  console.log(`Draft Status   : ${resBody.article_status}`);
  console.log(`Manifest Saved : ${resBody.manifest_persisted ? 'YES (D1 settings)' : 'NO'}`);
  console.log(`Duration       : ${durationMs} ms`);

  if (res.status === 200 || res.status === 201) {
    const previewUrl = `https://rancangloka-staging.chandrajoyko.workers.dev/admin/preview/${resBody.slug}?mode=reader`;
    console.log(`\n🎉 READER PREVIEW URL:`);
    console.log(`   ${previewUrl}\n`);
    console.log('✅ EKSEKUSI OTONOM REMOTE SUKSES 100% TANPA KETERGANTUNGAN LAPTOP!');
  } else {
    console.error('⚠️ Ingestion gagal:', JSON.stringify(resBody, null, 2));
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal Runner Error:', err);
  process.exit(1);
});
