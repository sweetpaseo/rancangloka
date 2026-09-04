import { validateArticle } from './validate-article.js';

console.log('--- Testing Deterministic Article Validator ---');

// Test 1: Banned placeholder
const sampleWithPlaceholder = `---
title: "Test Title"
description: "Test Description"
category: "Arsitektur"
author: "Author"
focus_keyword: "kw"
key_takeaways:
  - "Item 1"
  - "Item 2"
  - "Item 3"
---
## Bagian Pertama
Isi artikel dengan TODO di sini. ${'kata '.repeat(350)}`;
const r1 = validateArticle(sampleWithPlaceholder);
console.log('1. Banned placeholder rejected:', !r1.isValid && r1.errors.some(e => e.includes('TODO')));

// Test 2: Missing H2
const sampleNoH2 = `---
title: "Test Title"
description: "Test Description"
category: "Arsitektur"
author: "Author"
focus_keyword: "kw"
key_takeaways:
  - "Item 1"
  - "Item 2"
  - "Item 3"
---
Paragraf tanpa heading sama sekali. ${'kata '.repeat(350)}`;
const r2 = validateArticle(sampleNoH2);
console.log('2. Missing H2 rejected:', !r2.isValid && r2.errors.some(e => e.includes('H2')));

// Test 3: Short word count (<300)
const sampleShort = `---
title: "Test Title"
description: "Test Description"
category: "Arsitektur"
author: "Author"
focus_keyword: "kw"
key_takeaways:
  - "Item 1"
  - "Item 2"
  - "Item 3"
---
## Bagian Utama
Hanya beberapa kata saja di sini.`;
const r3 = validateArticle(sampleShort);
console.log('3. Short word count (<300) rejected:', !r3.isValid && r3.errors.some(e => e.includes('Jumlah kata')));

// Test 4: Key takeaways count (<3 or >5)
const sampleTakeaways = `---
title: "Test Title"
description: "Test Description"
category: "Arsitektur"
author: "Author"
focus_keyword: "kw"
key_takeaways:
  - "Item 1"
---
## Bagian Utama
${'kata '.repeat(350)}`;
const r4 = validateArticle(sampleTakeaways);
console.log('4. Bad takeaways count (<3) rejected:', !r4.isValid && r4.errors.some(e => e.includes('3-5 butir')));

// Test 5: Missing image_alt when featured_image is provided
const sampleMissingAlt = `---
title: "Test Title"
description: "Test Description"
category: "Arsitektur"
author: "Author"
focus_keyword: "kw"
featured_image: "https://example.com/image.jpg"
key_takeaways:
  - "Item 1"
  - "Item 2"
  - "Item 3"
---
## Bagian Utama
${'kata '.repeat(350)}`;
const r5 = validateArticle(sampleMissingAlt);
console.log('5. Missing image_alt rejected:', !r5.isValid && r5.errors.some(e => e.includes('image_alt')));
