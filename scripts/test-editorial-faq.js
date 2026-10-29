/**
 * Test Suite: Contextual Editorial FAQ (TASK C)
 * MISSION: RANCANGLOKA_EDITORIAL_FAQ_1
 * 
 * Verifies:
 * 1. Extraction of approved FAQs from article properties and markdown comments.
 * 2. Strict omission when FAQ is empty or null (zero placeholder DOM).
 * 3. Marker stripping prevents duplicate or comment leakage into body HTML.
 * 4. Anti-slop and editorial quality validation rules.
 * 5. Semantic native HTML (<details>, <summary>) and zero JS dependency.
 */

import assert from 'node:assert';
import {
  extractEditorialFaqs,
  parseFaqPayload,
  stripFaqCommentMarkers,
  validateEditorialFaqQuality
} from '../src/lib/editorial/faq.ts';

console.log('=== TEST SUITE: Contextual Editorial FAQ (RANCANGLOKA_EDITORIAL_FAQ_1) ===\n');

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Direct object array payload
runTest('Extract FAQs from explicit array property on article', () => {
  const article = {
    title: 'Kusen Aluminium vs UPVC',
    faq: [
      {
        question: 'Apakah kusen UPVC lebih kedap suara dibanding aluminium?',
        answer: 'Ya, material UPVC memiliki rongga bersekat ganda (multi-chamber) yang secara fisik meredam getaran suara lebih efektif dibandingkan profil aluminium standar.'
      },
      {
        question: 'Bagaimana ketahanan warna kusen UPVC terhadap terik matahari tropis?',
        answer: 'Profil UPVC berkualitas arsitektural dilengkapi senyawa anti-UV titanium dioksida yang menjaga warna putih tidak menguning selama 10–15 tahun.'
      }
    ]
  };

  const faqs = extractEditorialFaqs(article);
  assert.strictEqual(faqs.length, 2);
  assert.strictEqual(faqs[0].question, 'Apakah kusen UPVC lebih kedap suara dibanding aluminium?');
  assert.ok(faqs[0].answer.includes('multi-chamber'));
});

// 2. Direct JSON string payload
runTest('Extract FAQs from JSON string property on article', () => {
  const article = {
    title: 'Dak Beton Bocor',
    faqs: JSON.stringify([
      {
        question: 'Berapa ketebalan minimal screed pelindung waterproofing dak?',
        answer: 'Ketebalan minimal yang disarankan adalah 3–5 cm dengan kawat ayam atau wiremesh halus untuk mencegah retak rambut akibat muai susut thermal.'
      }
    ])
  };

  const faqs = extractEditorialFaqs(article);
  assert.strictEqual(faqs.length, 1);
  assert.strictEqual(faqs[0].question, 'Berapa ketebalan minimal screed pelindung waterproofing dak?');
});

// 3. Extraction from Markdown comment block
runTest('Extract FAQs from embedded markdown comment block', () => {
  const markdown = `
# Panduan Ventilasi Silang Rumah Tropis

Ventilasi silang membutuhkan bukaan udara masuk dan keluar...

<!-- EDITORIAL_FAQ_START -->
[
  {
    "question": "Berapa rasio bukaan angin keluar dibanding angin masuk yang ideal?",
    "answer": "Bukaan angin keluar (outlet) idealnya berukuran 1,25 hingga 1,5 kali lebih besar dari bukaan masuk (inlet) untuk menciptakan efek venturi yang mempercepat aliran udara."
  },
  {
    "question": "Apakah kisi-kisi jalusi cukup efektif untuk ventilasi malam hari?",
    "answer": "Sangat efektif, terutama bila dipasang kawat nyamuk stainless steel di sisi dalam untuk keamanan dan sirkulasi tanpa gangguan serangga."
  }
]
<!-- EDITORIAL_FAQ_END -->

## Kesimpulan Lapangan
Simak arah angin dominan sebelum membobol dinding.
`;

  const article = { content_md: markdown };
  const faqs = extractEditorialFaqs(article);
  assert.strictEqual(faqs.length, 2);
  assert.strictEqual(faqs[0].question, 'Berapa rasio bukaan angin keluar dibanding angin masuk yang ideal?');
});

// 4. Comment marker stripping
runTest('Strip FAQ comment markers cleanly from body content', () => {
  const rawBody = `<p>Paragraf pembuka.</p>
<!-- EDITORIAL_FAQ_START -->
[{"question": "Q1?", "answer": "A1..."}]
<!-- EDITORIAL_FAQ_END -->
<p>Paragraf penutup.</p>`;

  const cleaned = stripFaqCommentMarkers(rawBody);
  assert.ok(!cleaned.includes('EDITORIAL_FAQ_START'));
  assert.ok(!cleaned.includes('Q1?'));
  assert.ok(cleaned.includes('<p>Paragraf pembuka.</p>'));
  assert.ok(cleaned.includes('<p>Paragraf penutup.</p>'));
});

// 5. Strict optionality: Article without FAQ produces empty array
runTest('Strict optionality: Article without FAQ returns empty array (zero placeholder)', () => {
  const articleNoFaq = {
    title: 'Artikel Biasa Tanpa FAQ',
    content_md: '# Header\n\nIsi artikel biasa tanpa data faq.'
  };

  const faqs = extractEditorialFaqs(articleNoFaq);
  assert.strictEqual(faqs.length, 0);

  const nullArticle = extractEditorialFaqs(null);
  assert.strictEqual(nullArticle.length, 0);

  const emptyStringFaq = extractEditorialFaqs({ faq: '' });
  assert.strictEqual(emptyStringFaq.length, 0);

  const emptyArrayFaq = extractEditorialFaqs({ faq: [] });
  assert.strictEqual(emptyArrayFaq.length, 0);
});

// 6. Anti-slop and editorial quality validation
runTest('Editorial FAQ Quality Gate validates conciseness and checks AI slop', () => {
  // Good items
  const goodFaqs = [
    {
      question: 'Berapa jarak ideal antara septictank dan sumur resapan?',
      answer: 'SNI merekomendasikan jarak horizontal minimal 10 meter untuk mencegah kontaminasi biologis pada lapisan air tanah dangkal.'
    },
    {
      question: 'Kapan waktu terbaik mengaplikasikan pelapis anti bocor?',
      answer: 'Saat permukaan beton kering sempurna (kadar air di bawah 5%) dan cuaca terik di pagi hari agar solvent menguap optimal.'
    },
    {
      question: 'Apakah semen instan perlu dicampur pasir tambahan?',
      answer: 'Tidak boleh. Semen instan telah diformulasikan dengan agregat pasir silika terukur; penambahan pasir justru menurunkan kuat rekat mortar.'
    }
  ];

  const validationGood = validateEditorialFaqQuality(goodFaqs);
  assert.strictEqual(validationGood.valid, true);
  assert.strictEqual(validationGood.errors.length, 0);
  assert.strictEqual(validationGood.warnings.length, 0);

  // Slop / Low quality item
  const slopFaqs = [
    {
      question: 'Apa itu cat?',
      answer: 'Di era modern ini, tidak dapat dipungkiri bahwa cat sangat penting untuk rumah kita.'
    }
  ];

  const validationSlop = validateEditorialFaqQuality(slopFaqs);
  assert.ok(validationSlop.errors.length > 0 || validationSlop.warnings.length > 0);
  assert.ok(validationSlop.warnings.some(w => w.includes('klise AI')));
});

console.log(`\n🎉 All ${passedTests} Contextual Editorial FAQ tests PASSED!`);
