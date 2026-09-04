/**
 * RancangLoka — Author Resolution & Mock-Fallback Hardening Regression Tests
 *
 * Validates:
 * A. real/mock DB query returns canonical author -> resolution succeeds
 * B. DB query returns [] -> getAllAuthors returns []
 * C. DB query returns [] -> canonical article pipeline throws AUTHOR_NOT_FOUND
 * D. empty author table does NOT cause MOCK_AUTHORS injection
 * E. DB error is surfaced and does not become mock data
 * F. Hermes canonical author works end-to-end when the actual DB contains that row
 */

import { getAllAuthors } from '../src/lib/db.ts';
import { resolveAuthor } from '../src/lib/authors.ts';
import { normalizeArticle } from '../src/lib/article/pipeline.ts';
import { AuthorNotFoundError } from '../src/lib/errors.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

const longValidMarkdown = `---
title: "Rekayasa Sirkulasi Alami pada Void Hunian Tropis Modern"
slug: "rekayasa-sirkulasi-alami-pada-void-hunian-tropis-modern"
description: "Panduan teknis perancangan void rumah tinggal untuk optimalisasi ventilasi pasif termal dan sirkulasi udara alami iklim tropis lembap."
category: "Arsitektur & Renovasi"
author: "RancangLoka Editorial Desk"
published_at: "2026-09-04T12:00:00Z"
key_takeaways:
  - "Ventilasi silang membutuhkan void setinggi minimal 4 meter"
  - "Optimalisasi thermal stack effect menurunkan suhu hingga 3 derajat Celsius"
  - "Orientasi bukaan atas harus bebas hambatan angin primer"
focus_keyword: "sirkulasi void tropis"
---

## Pengantar Spasial

Perancangan void dalam konteks hunian tropis bukan semata keputusan estetika visual melainkan instrumen rekayasa termal pasif yang vital. Dalam iklim tropis lembap dengan tingkat radiasi matahari tinggi dan kelembapan konstan, akumulasi panas di lantai atas sering kali menyebabkan ketergantungan berlebihan pada pendingin udara mekanis. Melalui penerapan prinsip ventilasi tumpukan atau stack ventilation, udara panas yang lebih ringan secara alami akan terdorong ke tingkat paling atas hunian sebelum dibuang keluar melalui kisi ventilasi.

Ketika merancang denah terbuka dengan bukaan vertikal, integrasi antara jalur masuk angin di lantai dasar dan jalur pembuangan udara panas di lantai atas harus dihitung dengan seksama. Jika bukaan keluar di lantai atas terlalu sempit atau terhalang oleh konstruksi plafon mati, panas justru akan berputar kembali ke lantai mezzanine dan kamar tidur utama di lantai dua. Fenomena turbulensi termal ini kerap menjadi keluhan utama penghuni yang mengeluhkan lantai atas tetap terasa gerah meskipun void rumah berukuran relatif luas.

## Metodologi Ventilasi Alami

Prinsip efek tumpukan mengandalkan perbedaan tekanan udara dan massa jenis termal. Udara dingin yang masuk dari bukaan bawah seperti jendela louvre atau taman samping mengalir menyapu lantai dasar sebelum terhisap ke arah void tengah. Bukaan pelepasan udara panas di bagian atas void seperti skylight berjalusi atau celah clerestory harus dirancang dengan rasio dimensi yang proporsional terhadap volume total void guna menghindari turbulensi balik yang menurunkan efisiensi pertukaran udara.

Berdasarkan pengujian lapangan pada beberapa prototipe hunian berlantai dua di kawasan Jabodetabek, efektivitas pelepasan panas meningkat secara signifikan apabila bukaan atas memiliki luas penampang efektif minimal lima belas persen dari luas dasar void. Di samping itu, pemilihan material dinding void menggunakan plester semen ekspos berpori atau bata terakota terbukti membantu menstabilkan fluktuasi kelembapan udara relatif dalam batas nyaman antara lima puluh hingga enam puluh persen tanpa bantuan dehumidifier mekanis tambahan.

## Detail Spesifikasi Konstruksi

Elemen kanopi dan kisi-kisi pelindung tampias hujan pada clerestory void bagian atas wajib menggunakan material tahan korosi seperti aluminium ekstrusi berlapis bubuk powder-coated atau baja nirkarat seri 304. Sudut kemiringan bilah kisi sebesar empat puluh lima derajat terbukti optimal dalam menahan tempias angin kencang sekaligus meloloskan aliran udara hangat keluar secara konstan tanpa terhambat hambatan statis berlebih.

Penempatan bukaan samping yang berseberangan dengan arah datang angin monsun timur laut memungkinkan terciptanya zona tekanan negatif di sisi clerestory belakang. Efek Venturi ini secara aktif menarik udara panas dari ruang keluarga di bawahnya tanpa bantuan kipas hisap mekanis sedikit pun, sehingga menghemat konsumsi energi operasional rumah tangga jangka panjang secara terukur dan berkelanjutan.
`;

async function runTests() {
  console.log('--- Test Suite: Author Resolution & Fallback Hardening ---');

  // Test A: Real/mock DB query returns canonical author -> resolution succeeds
  {
    const mockDbWithAuthor = {
      prepare(sql) {
        return {
          async all() {
            return {
              results: [
                {
                  id: 3,
                  name: 'RancangLoka Editorial Desk',
                  slug: 'dewan-redaksi-spasial',
                  role: 'Editorial Desk'
                }
              ]
            };
          }
        };
      }
    };
    const authors = await getAllAuthors(mockDbWithAuthor);
    assert(authors.length === 1 && authors[0].id === 3, 'Test A: getAllAuthors returns canonical author from DB');
    const resolved = resolveAuthor('RancangLoka Editorial Desk', authors);
    assert(resolved !== null && resolved.author.slug === 'dewan-redaksi-spasial', 'Test A: resolution succeeds for canonical author');
  }

  // Test B: DB query returns [] -> getAllAuthors returns []
  {
    const mockEmptyDb = {
      prepare(sql) {
        return {
          async all() {
            return { results: [] };
          }
        };
      }
    };
    const authors = await getAllAuthors(mockEmptyDb);
    assert(Array.isArray(authors) && authors.length === 0, 'Test B: DB returning [] results in getAllAuthors returning []');
  }

  // Test C: DB query returns [] -> canonical article pipeline throws AUTHOR_NOT_FOUND
  {
    const mockEmptyDb = {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() { return null; },
          async all() {
            if (sql.includes('FROM categories')) {
              return { results: [{ id: 1, name: 'Arsitektur & Renovasi', slug: 'arsitektur-renovasi' }] };
            }
            if (sql.includes('FROM authors')) {
              return { results: [] };
            }
            return { results: [] };
          }
        };
      }
    };

    let caughtError = null;
    try {
      await normalizeArticle(longValidMarkdown, mockEmptyDb);
    } catch (err) {
      caughtError = err;
    }
    assert(caughtError instanceof AuthorNotFoundError, 'Test C: pipeline throws AuthorNotFoundError when authors table is empty');
    assert(caughtError && caughtError.code === 'AUTHOR_NOT_FOUND', 'Test C: error code is AUTHOR_NOT_FOUND');
  }

  // Test D: Empty author table does NOT cause MOCK_AUTHORS injection
  {
    const mockEmptyDb = {
      prepare(sql) {
        return {
          async all() {
            return { results: [] };
          }
        };
      }
    };
    const authors = await getAllAuthors(mockEmptyDb);
    assert(authors.length === 0, 'Test D: empty table results in 0 authors (no MOCK_AUTHORS)');
    const resolution = resolveAuthor('RancangLoka Editorial Desk', authors);
    assert(resolution === null, 'Test D: cannot resolve canonical author against empty DB');
  }

  // Test E: DB error is surfaced and does not become mock data
  {
    const mockFailingDb = {
      prepare(sql) {
        throw new Error('D1 connection reset');
      }
    };
    let threw = false;
    let errMessage = '';
    try {
      await getAllAuthors(mockFailingDb);
    } catch (e) {
      threw = true;
      errMessage = e.message;
    }
    assert(threw, 'Test E: DB error is thrown');
    assert(errMessage === 'D1 connection reset', 'Test E: original DB error surfaced');
  }

  // Test F: Hermes canonical author works end-to-end when actual DB contains that row
  {
    const mockDbWithCanonical = {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() { return null; },
          async all() {
            if (sql.includes('FROM categories')) {
              return { results: [{ id: 1, name: 'Arsitektur & Renovasi', slug: 'arsitektur-renovasi' }] };
            }
            if (sql.includes('FROM authors')) {
              return {
                results: [
                  {
                    id: 3,
                    name: 'RancangLoka Editorial Desk',
                    slug: 'dewan-redaksi-spasial',
                    role: 'Editorial Desk'
                  }
                ]
              };
            }
            return { results: [] };
          }
        };
      }
    };

    const normalized = await normalizeArticle(longValidMarkdown, mockDbWithCanonical);
    assert(normalized.author_id === 3, 'Test F: author_id successfully resolved to 3');
    assert(normalized.slug === 'rekayasa-sirkulasi-alami-pada-void-hunian-tropis-modern', 'Test F: article normalized successfully');
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Unhandled error in test-author-regression:', err);
  process.exit(1);
});
