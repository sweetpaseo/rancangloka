import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditPublicBodyCleanliness,
  evaluateHumanWritingQuality
} from '../src/lib/article/human-quality.ts';

test('PUBLIC-BODY CLEANLINESS GATE & RINA SOURCE-LANGUAGE HYGIENE', async (t) => {
  await t.test('1. Fails when raw [CLM-*] markers appear in public body', () => {
    const text = 'Kaca ganda membantu meredam panas [CLM-01]. Permukaan jendela tetap aman.';
    const res = auditPublicBodyCleanliness(text);
    assert.strictEqual(res.passed, false);
    assert.ok(res.violations.some(v => v.type === 'RAW_CLAIM_MARKER'));
  });

  await t.test('2. Fails when passage IDs or source IDs appear in public body', () => {
    const text = 'Berdasarkan PSG-001 dari SRC-01, suhu titik embun tercapai saat udara jenuh.';
    const res = auditPublicBodyCleanliness(text);
    assert.strictEqual(res.passed, false);
    assert.ok(res.violations.some(v => v.type === 'PASSAGE_ID'));
    assert.ok(res.violations.some(v => v.type === 'SOURCE_ID'));
  });

  await t.test('3. Fails when internal metadata keywords leak into public body', () => {
    const text = 'Tabel ini memetakan author_safe_claims untuk kebutuhan verifikasi.';
    const res = auditPublicBodyCleanliness(text);
    assert.strictEqual(res.passed, false);
    assert.ok(res.violations.some(v => v.type === 'INTERNAL_METADATA'));
  });

  await t.test('4. Fails when parenthesized English evidence clauses leak into public body', () => {
    const text = 'Kondensasi perlu diperhatikan (if you see condensation or moisture collecting on windows). Buka jendela (allow ventilation) untuk sirkulasi.';
    const res = auditPublicBodyCleanliness(text);
    assert.strictEqual(res.passed, false);
    assert.ok(res.violations.some(v => v.type === 'SOURCE_LANGUAGE_ECHO'));
  });

  await t.test('5. Passes clean Indonesian text with approved technical terms', () => {
    const cleanText = `
# Memahami Isolasi Termal pada Jendela Rumah Tropis

Ketika musim hujan tiba di iklim tropis lembap Indonesia, perbedaan suhu antara ruang berpendingin udara dan luar ruangan sering memicu persoalan pada bukaan rumah.

Kusen aluminium tanpa pemutus termal (thermal break) akan menghantarkan panas secara langsung. Fenomena jembatan termal (thermal bridge) ini membuat konsumsi energi pendingin ruangan melonjak. Dengan menggunakan kaca insulasi (insulating glass) berefisiensi tinggi dengan nilai transmisi termal (U-value) yang rendah, serta lapisan emisivitas rendah (low-e), kenyamanan termal dalam ruangan dapat terjaga secara optimal.

Langkah utama yang perlu dilakukan pemilik rumah adalah memeriksa ventilasi silang dan memastikan jalur pembuangan air pada bingkai jendela tidak tersumbat.
    `.trim();

    const res = auditPublicBodyCleanliness(cleanText);
    assert.strictEqual(res.passed, true);
    assert.strictEqual(res.violations.length, 0);
  });

  await t.test('6. Rina Blind-Spot Check: Article with repeated source echoes CANNOT receive a 100 score unnoticed', () => {
    const textWithEchoes = `
# Memahami Kondensasi Kaca Jendela pada Hunian Tropis

Ketika musim hujan tiba di iklim tropis lembap Indonesia, embun sering muncul pada kaca jendela ruang ber-AC.

Pemeriksaan perlu segera dilakukan (if you see condensation or moisture collecting on windows). Ventilasi alami harus dibuka (allow ventilation) untuk membuang kelembapan berlebih. Saat udara luar sangat lembap, gunakan pendingin atau pengering udara (use air conditioners and/or de-humidifiers when needed). Kaca ganda memiliki sifat termal yang berbeda (a thermal bridge has significantly higher heat transfer than the surrounding assembly).

Pemilik rumah di daerah tropis perlu memperhatikan sirkulasi udara dan ventilasi silang agar tampias hujan serta kelembapan tidak merusak plesteran dinding.
    `.trim();

    const res = evaluateHumanWritingQuality(textWithEchoes);
    assert.ok(res.issues.some(i => i.code === 'SOURCE_LANGUAGE_ECHO_DETECTED'), 'Must detect SOURCE_LANGUAGE_ECHO_DETECTED');
    assert.notStrictEqual(res.total_score, 100, 'Article with repeated source echoes must NOT receive 100 points');
    assert.ok(res.total_score < 90, `Score must reflect penalty (got ${res.total_score})`);
  });
});
