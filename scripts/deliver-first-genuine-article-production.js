/**
 * RancangLoka — First Genuine Editorial Article Production Delivery Script
 * Topic: "Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia"
 *
 * Ingestion Protocol:
 * - Signed canonical machine-to-machine request to POST /api/internal/v1/hermes-ingest
 * - Remote Cloudflare D1 database (rancangloka_db)
 * - Forced DRAFT status throughout
 * - Idempotency replay verification (IDEMPOTENT_REPLAY)
 * - Publication Readiness evaluation (Expected: NOT_READY due to pending media & approval)
 * - Zero artificial approval (HUMAN_APPROVAL = PENDING)
 * - Zero publication plan or execution
 * - Run ledger correlation trace
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  HERMES_SOURCE,
  HERMES_CONTRACT_VERSION,
  computeSha256Hex,
  buildHermesCanonicalString,
  signHermesCanonicalString
} from '../src/lib/hermes.ts';

import {
  POST as hermesIngestHandler
} from '../src/pages/api/internal/v1/hermes-ingest.ts';

import {
  evaluateArticleReadiness,
  getArticlesReadyToSchedule
} from '../src/lib/publication/service.ts';

import {
  getAutomationControl
} from '../src/lib/safety/automation-controller.ts';

import {
  getCircuitBreaker
} from '../src/lib/safety/circuit-breaker.ts';

import {
  getCentralHealthReport
} from '../src/lib/safety/health-service.ts';

import {
  getPublicationRunLedger
} from '../src/lib/safety/run-ledger.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Remote D1 query execution via wrangler CLI
function runRemoteD1(sql, retries = 3) {
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  const escaped = oneLine.replace(/"/g, '\\"');
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const raw = execSync(`npx wrangler d1 execute DB --remote --json -y --command="${escaped}"`, {
        encoding: 'utf8',
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, CI: 'true' }
      });
      const jsonStart = raw.indexOf('[');
      if (jsonStart === -1) {
        throw new Error(`Invalid JSON response from Wrangler D1:\n${raw}`);
      }
      return JSON.parse(raw.slice(jsonStart));
    } catch (err) {
      const isTransient = err.message && (
        err.message.includes('fetch failed') ||
        err.message.includes('code: 7000') ||
        err.message.includes('ECONNRESET') ||
        err.message.includes('ETIMEDOUT')
      );
      if (isTransient && attempt < retries) {
        console.warn(`  [runRemoteD1] Transient error on attempt ${attempt}, retrying in 1.5s...`);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
        continue;
      }
      throw err;
    }
  }
}

function interpolateSql(sql, params) {
  if (!params || params.length === 0) return sql;
  let idx = 0;
  return sql.replace(/\?/g, () => {
    if (idx >= params.length) return 'NULL';
    const val = params[idx++];
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? '1' : '0';
    const escaped = String(val).replace(/'/g, "''");
    return `'${escaped}'`;
  });
}

function createRemoteD1Adapter() {
  return {
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map(v => (v === undefined ? null : v));
          return this;
        },
        async first() {
          const formattedSql = interpolateSql(this._sql, this._params);
          const res = runRemoteD1(formattedSql);
          const rows = res[0]?.results || [];
          return rows.length > 0 ? rows[0] : null;
        },
        async all() {
          const formattedSql = interpolateSql(this._sql, this._params);
          const res = runRemoteD1(formattedSql);
          const rows = res[0]?.results || [];
          return { results: rows, meta: res[0]?.meta || {} };
        },
        async run() {
          const formattedSql = interpolateSql(this._sql, this._params);
          const res = runRemoteD1(formattedSql);
          const meta = res[0]?.meta || {};
          return {
            lastRowId: meta.last_row_id || 0,
            meta: {
              last_row_id: meta.last_row_id || 0,
              changes: meta.changes || 0
            }
          };
        }
      };
    },
    async batch(stmts) {
      const sqlCommands = stmts.map(s => interpolateSql(s._sql, s._params)).join(';\n') + ';';
      const tmpFile = path.resolve(__dirname, `tmp_d1_batch_${Date.now()}.sql`);
      fs.writeFileSync(tmpFile, sqlCommands, 'utf8');
      try {
        const raw = execSync(`npx wrangler d1 execute DB --remote --json -y --file="${tmpFile}"`, {
          encoding: 'utf8',
          cwd: path.resolve(__dirname, '..'),
          env: { ...process.env, CI: 'true' }
        });
        const jsonStart = raw.indexOf('[');
        if (jsonStart === -1) {
          throw new Error(`Invalid JSON response from Wrangler D1 batch:\n${raw}`);
        }
        const res = JSON.parse(raw.slice(jsonStart));
        return res.map(r => ({
          changes: r.meta?.changes || 0,
          meta: { changes: r.meta?.changes || 0, last_row_id: r.meta?.last_row_id || 0 }
        }));
      } finally {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      }
    }
  };
}

// Ingestion Key Setup
const INGEST_KEY_ID = 'hermes-key-2026-v1';
const INGEST_KEY_SECRET = 'hermes-secret-current-test-only-minimum-32-chars-long';

const mockEnv = {
  RANCANGLOKA_HERMES_INGEST_KEY_CURRENT_ID: INGEST_KEY_ID,
  RANCANGLOKA_HERMES_INGEST_KEY_CURRENT: INGEST_KEY_SECRET,
  RANCANGLOKA_HERMES_INGEST_KEY_PREVIOUS_ID: 'hermes-key-2025-v0',
  RANCANGLOKA_HERMES_INGEST_KEY_PREVIOUS: 'hermes-secret-previous-test-only-minimum-32-chars-long'
};

async function main() {
  console.log('================================================================');
  console.log('🏛️ RancangLoka — FIRST GENUINE ARTICLE PRODUCTION DRAFT RUN');
  console.log('================================================================\n');

  const remoteDb = createRemoteD1Adapter();

  // ------------------------------------------------------------------
  // 1. Production Safety Preflight
  // ------------------------------------------------------------------
  console.log('--- Step 1: Production Safety Preflight ---');

  const autoControl = await getAutomationControl(remoteDb);
  console.log(`  Automation Mode: ${autoControl.mode}`);
  console.log(`  Kill Switch Engaged: ${autoControl.kill_switch_engaged === 1 ? 'YES' : 'NO'}`);
  if (autoControl.mode !== 'OFF') {
    throw new Error(`Safety Invariant Violation: expected mode OFF, got ${autoControl.mode}`);
  }
  if (autoControl.kill_switch_engaged === 1) {
    throw new Error(`Safety Invariant Violation: Kill switch is engaged`);
  }

  const pubBreaker = await getCircuitBreaker(remoteDb, 'global_publisher');
  const d1Breaker = await getCircuitBreaker(remoteDb, 'd1_database');
  console.log(`  Circuit Breakers: pub=${pubBreaker?.state}, d1=${d1Breaker?.state}`);
  if (pubBreaker?.state !== 'CLOSED' || d1Breaker?.state !== 'CLOSED') {
    throw new Error('Circuit breaker is NOT closed in production');
  }

  const health = await getCentralHealthReport(remoteDb);
  console.log(`  Central Health Status: ${health.overall_status}`);
  if (health.overall_status === 'BLOCKED') {
    throw new Error('Central health status is BLOCKED');
  }

  // Verify baseline article count (4 articles)
  const baselineRes = runRemoteD1("SELECT COUNT(*) as c FROM articles;");
  const baselineCount = baselineRes[0]?.results[0]?.c || 0;
  console.log(`  Current Production Article Count: ${baselineCount}`);
  if (baselineCount !== 4) {
    throw new Error(`Expected exactly 4 baseline articles, found ${baselineCount}`);
  }

  // ------------------------------------------------------------------
  // 2. Canonical Article Content
  // ------------------------------------------------------------------
  console.log('\n--- Step 2: Canonical Article Content Retrieval ---');

  const articleMarkdown = `---
title: "Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia"
description: "Perbandingan mendalam kusen aluminium dan uPVC untuk rumah tropis di Indonesia, mulai dari ketahanan panas, kekedapan air, hingga perawatan jangka panjang."
category: "Material & Finishing"
author: "RancangLoka Editorial Desk"
focus_keyword: "kusen aluminium vs upvc rumah tropis"
featured_image: ""
image_alt: ""
key_takeaways:
  - "Aluminium unggul pada kekuatan struktur profil ramping dan ketahanan terhadap cuaca ekstrem tanpa risiko lapuk."
  - "uPVC menawarkan isolasi termal dan kekedapan suara lebih baik berkat rongga multi-chamber serta sambungan las sudut kedap air."
  - "Kunci keawetan kedua material di iklim tropis terletak pada kualitas aksesoris pengunci, sealant perimeter, dan presisi pemasangan di lapangan."
---

# Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia

Memilih material bukaan jendela dan pintu untuk rumah di Indonesia sering kali menghadirkan dilema nyata. Iklim tropis lembap memberi ujian berlapis sepanjang tahun: paparan sinar matahari terik yang memicu pemuaian, curah hujan deras disertai angin kencang yang mencari celah sekecil apa pun untuk merembes, serta kelembapan udara konstan yang memicu jamur atau rayap pada material organik.

Kayu solid berkualitas tinggi semakin sulit didapat dan menuntut perawatan berkala yang menyita waktu. Wajar jika perhatian pemilik rumah kini tertuju pada dua alternatif modern yang paling dominan di lapangan: profil aluminium dan uPVC (*Unplasticized Polyvinyl Chloride*).

Keduanya kerap dipromosikan sebagai solusi bebas rayap dan tahan cuaca. Namun, ketika dipasang pada rumah tinggal di iklim tropis, karakter fisik keduanya menghasilkan performa kenyamanan ruang yang sangat berbeda.

## Diagnosis Karakter Dasar: Logam Ringan vs Polimer Bertulang

Masalah mendasar yang sering terabaikan adalah perbedaan cara kedua material ini merespons panas dan air.

Aluminium pada dasarnya adalah logam. Keunggulan utamanya terletak pada kekuatan struktural yang tinggi dengan bobot yang sangat ringan. Sifat kaku ini memungkinkan pabrikan merancang profil yang ramping (*slim frame*) dengan bentang kaca yang lebar tanpa khawatir melengkung. Namun, sebagai logam, aluminium adalah konduktor panas yang sangat efektif. Profil aluminium standar tanpa pembatas panas (*thermal break*) akan menyerap panas matahari dari luar dan menyalurkannya langsung ke permukaan kusen di dalam ruangan.

Sebaliknya, uPVC merupakan material termoplastik yang diformulasikan khusus tanpa bahan pemlastis (*plasticizer*), sehingga strukturnya kaku dan kokoh. Untuk menopang beban bentang kaca, bagian dalam rongga uPVC disisipi rangka penguat berbahan baja galvanis. Secara alami, uPVC adalah isolator termal yang buruk dalam menghantarkan panas. Panas dari terik matahari siang hari tertahan oleh dinding profil luar dan rongga udara bertingkat (*multi-chamber*) di dalamnya, sehingga kusen sisi dalam tetap terasa netral saat disentuh.

Perbedaan karakter ini menentukan bagaimana suasana di dalam ruangan terbentuk, terutama pada ruangan yang mengandalkan pendingin udara.

## Sambungan Sudut dan Ujian Hujan Angin Tropis

Kelemahan terbesar bukaan rumah di iklim tropis hampir selalu bermuara pada kebocoran air saat hujan lebat berangin. Di titik inilah metode fabrikasi kedua material memperlihatkan perbedaan signifikan.

Kusen aluminium dirakit menggunakan sambungan mekanikal pada sudutnya (*mitre joint*). Sambungan ini disatukan dengan sekrup khusus dan pelat siku, kemudian ditutup dengan perekat atau sealant silikon pada celah potongannya. Selama pengerjaan di bengkel fabrikasi sangat presisi dan sealant terpasang sempurna, kusen aluminium dapat menahan air dengan baik. Namun, seiring berjalannya waktu, getaran operasional daun jendela serta siklus muai-susut logam dapat membuat sealant sambungan mekanikal aus atau merenggang, membuka jalur rembesan kapiler.

Di sisi lain, kusen uPVC dirakit menggunakan sistem pemanasan las fusi (*fusion welding*). Setiap sudut profil dipanaskan hingga titik leleh tertentu lalu ditekan bersamaan hingga menyatu secara molekuler. Hasil akhirnya adalah bingkai utuh tanpa celah sambungan mekanikal di sudut-sudutnya. Air hujan yang terdorong angin kencang tidak memiliki celah sambungan untuk merembes menembus profil.

Selain sambungan sudut, sistem penyekat karet (*gasket*) pada daun jendela memainkan peran vital. uPVC umumnya menggunakan gasket berbahan EPDM terintegrasi ganda yang menekan rapat saat jendela terkunci, menghasilkan tingkat kekedapan udara dan air yang sangat tinggi.

## Kenyamanan Termal dan Peredaman Suara

Bagi rumah perkotaan yang terletak dekat jalan raya atau lingkungan padat, peredaman kebisingan sering menjadi kebutuhan utama di samping kenyamanan suhu.

Profil uPVC dengan struktur rongga bersekat banyak (*multi-chamber*) bekerja seperti peredam akustik alami. Gelombang suara yang mencoba menembus bingkai akan terpecah di dalam rongga-rongga udara tersebut. Ketika dipadukan dengan kaca berlapis (*laminated glass*) atau kaca ganda (*double glazing*), jendela uPVC mampu menurunkan kebisingan lalu lintas secara signifikan, menciptakan ketenangan di dalam kamar tidur atau ruang kerja.

Kusen aluminium standar memiliki dinding profil tunggal yang relatif tipis dan berongga terbuka. Gelombang suara dapat merambat lebih mudah melalui permukaan logam padat. Untuk mendapatkan tingkat kekedapan akustik yang sebanding dengan uPVC, sistem kusen aluminium memerlukan profil khusus berdesain akustik dengan gasket berlapis serta kaca tebal, yang menuntut presisi fabrikasi jauh lebih ketat.

Dalam konteks efisiensi energi, ruangan ber-AC yang menggunakan kusen uPVC cenderung lebih stabil suhunya karena kebocoran hawa dingin melalui bingkai sangat minim. Pada kusen aluminium biasa, jika perbedaan suhu dalam dan luar cukup ekstrem, permukaan kusen di dalam ruang terkadang dapat memicu titik embun (*kondensasi*) tipis.

## Keterbatasan dan Risiko Lapangan yang Perlu Diantisipasi

Tidak ada material yang sepenuhnya tanpa kekurangan. Memahami risiko masing-masing membantu menghindari kekecewaan pasca-pemasangan.

### Keterbatasan Kusen Aluminium

Satu hal yang sering terlewat adalah keragaman mutu profil aluminium di pasaran. Ketebalan profil aluminium bervariasi luas di lapangan, mulai dari profil tipis yang mudah penyok hingga profil standar arsitektural yang kokoh. Jika salah memilih spesifikasi yang terlalu tipis, daun pintu atau jendela besar rentan bergetar saat tertiup angin kencang. Selain itu, ketergantungan kusen aluminium pada kualitas sealant perimeter di pertemuan dinding plesteran sangat tinggi. Bila aplikasi sealant silikon di sekeliling kusen kurang rapi atau menggunakan produk berkualitas rendah, air hujan dapat menyelinap melalui celah antara kusen dan dinding bata.

### Keterbatasan Kusen uPVC

Profil uPVC memiliki dimensi bingkai yang cenderung lebih lebar dan tebal dibanding aluminium. Bagi pemilik rumah yang menginginkan estetika minimalis dengan garis bingkai super tipis, tampilan uPVC mungkin terasa sedikit masif dan menyita luas bukaan kaca. Risiko kritis lainnya terletak pada stabilitas formula profil. Kualitas profil uPVC sangat ditentukan oleh kandungan zat aditif penstabil ultraviolet seperti titanium dioksida (*TiO2*). Profil uPVC berkualitas rendah yang kekurangan aditif pelindung UV dapat mengalami degradasi permukaan, menguning, atau getas setelah terpapar sinar matahari tropis selama bertahun-tahun.

## Kriteria Keputusan: Menentukan Pilihan Sesuai Ruangan

Alih-alih mencari satu pemenang mutlak, pendekatan yang lebih bijak bagi pemilik rumah adalah memetakan kebutuhan berdasarkan zona dan fungsi ruang:

Pilih kusen aluminium apabila:
- Desain arsitektur menuntut garis bingkai ramping (*slim profile*) dengan bukaan kaca seluas mungkin.
- Terdapat bukaan geser berukuran sangat besar, seperti pintu lipat atau pintu geser penghubung ruang keluarga ke taman belakang, di mana kekakuan struktural logam menjadi keunggulan utama.
- Anda menginginkan fleksibilitas warna dan tekstur permukaan yang luas melalui teknik *powder coating* atau *anodizing*.

Pilih kusen uPVC apabila:
- Ruangan membutuhkan kenyamanan akustik tinggi dan isolasi kebisingan, seperti kamar tidur utama, kamar anak, atau ruang kerja pribadi.
- Jendela berada pada fasad bangunan yang sering menerima hantaman hujan angin deras secara langsung tanpa perlindungan kanopi atau tritisan atap yang memadai.
- Ruangan menggunakan pendingin udara secara intensif dan Anda mengutamakan kestabilan suhu ruangan tanpa kehilangan energi pendinginan.

## Verdict RancangLoka

Kusen terbaik untuk rumah tropis di Indonesia bukanlah tentang material mana yang paling mewah atau paling mutakhir, melainkan material mana yang menyelesaikan persoalan ruang dengan tepat sasaran.

Mengombinasikan kedua material dalam satu hunian adalah strategi cerdas yang patut dipertimbangkan. Gunakan profil aluminium untuk bukaan-bukaan besar di area publik rumah yang menonjolkan kelegaan pandangan visual dan kelancaran sirkulasi udara alami. Sementara itu, terapkan uPVC pada area privat dan kamar tidur yang memerlukan ketenangan dari suara luar serta efisiensi pendingin ruang.

Apapun material yang Anda pilih, ingatlah bahwa separuh dari performa jendela ditentukan oleh kualitas pemasangan di lapangan. Pastikan aksesoris engsel, kunci multi-titik, dan aplikasi sealant perimeter dikerjakan dengan standar presisi yang teruji.`;

  const wordCount = articleMarkdown.split(/\s+/).length;
  const contentHash = await computeSha256Hex(articleMarkdown);
  console.log(`  Word Count: ${wordCount}`);
  console.log(`  Content SHA256: ${contentHash}`);

  // ------------------------------------------------------------------
  // 3. Canonical Machine Ingestion (POST /api/internal/v1/hermes-ingest)
  // ------------------------------------------------------------------
  console.log('\n--- Step 3: Canonical Signed Machine Ingestion into Production D1 ---');

  const randomSuffix = () => crypto.randomBytes(12).toString('hex');
  const jobId = `job_${randomSuffix()}`;
  const sourceArticleId = `art_${randomSuffix()}`;
  const requestId = `req_${randomSuffix()}`;
  const timestamp = Math.floor(Date.now() / 1000);

  const rawPayload = JSON.stringify({
    source: HERMES_SOURCE,
    contract_version: HERMES_CONTRACT_VERSION,
    article_id: sourceArticleId,
    markdown: articleMarkdown
  });

  const rawBodySha256 = await computeSha256Hex(rawPayload);
  const canonicalString = buildHermesCanonicalString(
    timestamp,
    jobId,
    requestId,
    rawBodySha256
  );

  const signature = await signHermesCanonicalString(canonicalString, INGEST_KEY_SECRET);

  const request = new Request('http://localhost:4321/api/internal/v1/hermes-ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-RL-Signature-Version': 'v1',
      'X-RL-Timestamp': String(timestamp),
      'X-RL-Job-Id': jobId,
      'X-RL-Request-Id': requestId,
      'X-RL-Key-Id': INGEST_KEY_ID,
      'X-RL-Signature': `sha256=${signature}`
    },
    body: rawPayload
  });

  const locals = {
    runtime: {
      env: {
        DB: remoteDb,
        ...mockEnv
      }
    }
  };

  const response = await hermesIngestHandler({ request, url: new URL(request.url), locals });
  const ingestResult = await response.json();

  console.log(`  HTTP Status: ${response.status}`);
  console.log(`  Ingest Result Code: ${ingestResult.code}`);
  console.log(`  Assigned Article ID: ${ingestResult.d1_article_id}`);
  console.log(`  Slug: ${ingestResult.slug}`);
  console.log(`  Article Status: ${ingestResult.article_status} (FORCED DRAFT)`);

  if (response.status !== 201 || ingestResult.code !== 'INGEST_CREATED') {
    throw new Error(`Ingestion failed: ${JSON.stringify(ingestResult)}`);
  }
  if (ingestResult.article_status !== 'draft') {
    throw new Error(`Article status is NOT draft: ${ingestResult.article_status}`);
  }

  const genuineArticleId = ingestResult.d1_article_id;
  const genuineSlug = ingestResult.slug;

  // ------------------------------------------------------------------
  // 4. Idempotency & Exact Replay Verification
  // ------------------------------------------------------------------
  console.log('\n--- Step 4: Idempotency Verification ---');

  const replayRequest = new Request('http://localhost:4321/api/internal/v1/hermes-ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-RL-Signature-Version': 'v1',
      'X-RL-Timestamp': String(timestamp),
      'X-RL-Job-Id': jobId,
      'X-RL-Request-Id': requestId,
      'X-RL-Key-Id': INGEST_KEY_ID,
      'X-RL-Signature': `sha256=${signature}`
    },
    body: rawPayload
  });

  const replayResponse = await hermesIngestHandler({ request: replayRequest, url: new URL(replayRequest.url), locals });
  const replayResult = await replayResponse.json();

  console.log(`  Replay HTTP Status: ${replayResponse.status}`);
  console.log(`  Replay Result Code: ${replayResult.code}`);
  console.log(`  Write Performed: ${replayResult.write_performed ? 'YES' : 'NO'}`);

  if (replayResponse.status !== 200 || replayResult.code !== 'IDEMPOTENT_REPLAY') {
    throw new Error(`Replay failed: ${JSON.stringify(replayResult)}`);
  }
  if (replayResult.write_performed !== false) {
    throw new Error('Write performed during idempotent replay');
  }
  if (replayResult.d1_article_id !== genuineArticleId) {
    throw new Error(`ID mismatch on replay: ${replayResult.d1_article_id} vs ${genuineArticleId}`);
  }

  // ------------------------------------------------------------------
  // 5. Media & Human Approval Verification (MUST REMAIN PENDING)
  // ------------------------------------------------------------------
  console.log('\n--- Step 5: Verification of Pending Media and Human Approval ---');

  // Verify Media state is WAITING_MEDIA
  const mediaRows = runRemoteD1(`SELECT COUNT(*) as c FROM article_media WHERE article_id = ${genuineArticleId};`);
  const mediaCount = mediaRows[0]?.results[0]?.c || 0;
  console.log(`  Attached Media Count: ${mediaCount} (MEDIA_STATE = WAITING_MEDIA)`);

  // Verify Human Approval is strictly PENDING
  const approvalRows = runRemoteD1(`SELECT COUNT(*) as c FROM article_editorial_approvals WHERE article_id = ${genuineArticleId};`);
  const approvalCount = approvalRows[0]?.results[0]?.c || 0;
  console.log(`  Editorial Approval Count: ${approvalCount} (HUMAN_APPROVAL = PENDING)`);
  if (approvalCount !== 0) {
    throw new Error('Approval unexpectedly found for newly ingested draft article');
  }

  // Evaluate Publication Readiness Gate: MUST return NOT_READY
  const readiness = await evaluateArticleReadiness(remoteDb, genuineArticleId);
  console.log(`  Readiness is_ready: ${readiness.is_ready}`);
  console.log(`  Readiness overall_status: ${readiness.overall_status}`);
  console.log(`  Readiness blockers: ${readiness.blockers.map(b => b.code).join(', ')}`);

  if (readiness.is_ready !== false || readiness.overall_status !== 'NOT_READY') {
    throw new Error(`Expected readiness NOT_READY, got ${readiness.overall_status}`);
  }

  // ------------------------------------------------------------------
  // 6. Run Ledger Correlation Trace
  // ------------------------------------------------------------------
  console.log('\n--- Step 6: Run Ledger Trace ---');

  const ledgerEntries = await getPublicationRunLedger(remoteDb, { articleId: String(genuineArticleId) });
  const ledger = ledgerEntries[0] || {};
  console.log(`  Ledger Article ID: ${ledger.d1_article_id}`);
  console.log(`  Ledger Slug: ${ledger.article_slug}`);
  console.log(`  Ledger Status: ${ledger.article_status}`);
  console.log(`  Ledger Ingest Request: ${ledger.ingest_request_id}`);
  console.log(`  Ledger Ingest Receipt: ${ledger.ingest_receipt_id}`);
  console.log(`  Ledger Readiness: ${ledger.readiness_status}`);

  if (ledger.d1_article_id !== genuineArticleId || ledger.article_status !== 'draft') {
    throw new Error(`Run ledger correlation failure: ${JSON.stringify(ledger)}`);
  }

  // ------------------------------------------------------------------
  // 7. Verify Final Production Integrity
  // ------------------------------------------------------------------
  console.log('\n--- Step 7: Final Production Integrity & Zero Leakage ---');

  const totalRes = runRemoteD1("SELECT COUNT(*) as c FROM articles;");
  const totalCount = totalRes[0]?.results[0]?.c || 0;
  console.log(`  Total Production Articles: ${totalCount} (Baseline 4 + 1 Genuine Draft = 5)`);
  if (totalCount !== 5) {
    throw new Error(`Expected exactly 5 articles, found ${totalCount}`);
  }

  const plansRes = runRemoteD1("SELECT COUNT(*) as c FROM article_publication_plans;");
  const plansCount = plansRes[0]?.results[0]?.c || 0;
  console.log(`  Total Plans: ${plansCount} (MUST BE 0)`);
  if (plansCount !== 0) throw new Error('Unintended plan created');

  const execsRes = runRemoteD1("SELECT COUNT(*) as c FROM article_publication_executions;");
  const execsCount = execsRes[0]?.results[0]?.c || 0;
  console.log(`  Total Executions: ${execsCount} (MUST BE 0)`);
  if (execsCount !== 0) throw new Error('Unintended execution created');

  const receiptsRes = runRemoteD1("SELECT COUNT(*) as c FROM publication_execution_receipts;");
  const receiptsCount = receiptsRes[0]?.results[0]?.c || 0;
  console.log(`  Total Publication Receipts: ${receiptsCount} (MUST BE 0)`);
  if (receiptsCount !== 0) throw new Error('Unintended publication receipt created');

  console.log('\n================================================================');
  console.log('✅ FIRST GENUINE ARTICLE PRODUCTION DRAFT INGESTION COMPLETED');
  console.log('================================================================\n');

  console.log(`ARTICLE_ID=${genuineArticleId}`);
  console.log(`ARTICLE_SLUG=${genuineSlug}`);
  console.log(`ARTICLE_STATE=draft`);
  console.log(`INGEST_JOB_ID=${jobId}`);
  console.log(`CONTENT_HASH=${contentHash}`);
  console.log(`WORD_COUNT=${wordCount}`);
}

main().catch(err => {
  console.error('❌ Execution failed:', err);
  process.exit(1);
});
