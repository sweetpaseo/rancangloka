/**
 * LokaBridge Studio — Structured Article Parser & Client Validation
 * File: extensions/lokamedia/src/bridge/bridge-parser.js
 *
 * Parses versioned JSON packages (primary clipboard path) or Markdown fallbacks,
 * runs preflight validations, and isolates fields for Smart Repair.
 */

export function stripCodeFences(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();
  // Strip outer ```json ... ``` or ```markdown ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json|markdown)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  }
  return cleaned;
}

export function parseStructuredEditorialPackage(rawInput, defaultProductionId = `prod_${Date.now()}`) {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      isValid: false,
      pkg: null,
      errors: ['Input naskah kosong.'],
      warnings: [],
      missingFields: ['content']
    };
  }

  const cleaned = stripCodeFences(rawInput);
  let parsedJson = null;

  try {
    parsedJson = JSON.parse(cleaned);
  } catch (_) {
    // Not JSON, check if it's markdown
  }

  if (parsedJson && typeof parsedJson === 'object' && !Array.isArray(parsedJson)) {
    return validateAndNormalizeJsonPackage(parsedJson, defaultProductionId);
  }

  // Fallback: Parse as raw assistant Markdown
  return parseMarkdownFallback(cleaned, defaultProductionId);
}

function validateAndNormalizeJsonPackage(json, defaultProductionId) {
  const errors = [];
  const warnings = [];
  const missingFields = [];

  const title = (json.title || json.seo_title || '').trim();
  const focusKeyword = (json.focus_keyword || json.focusKeyword || '').trim().toLowerCase();
  const contentMd = (json.content_md || json.contentMd || json.content || '').trim();
  const description = (json.description || json.meta_description || '').trim();
  const slug = (json.slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  if (!title) {
    errors.push("Field 'title' tidak boleh kosong.");
    missingFields.push('title');
  } else if (title.length < 40 || title.length > 65) {
    errors.push(`Panjang judul (${title.length} karakter) melanggar batas kanonikal SEO (40–65 karakter).`);
  }

  if (!focusKeyword) {
    errors.push("Field 'focus_keyword' tidak boleh kosong.");
    missingFields.push('focus_keyword');
  }

  if (!contentMd) {
    errors.push("Field 'content_md' tidak boleh kosong.");
    missingFields.push('content_md');
  } else {
    // Word count
    const words = contentMd.split(/\s+/).filter(Boolean).length;
    if (words < 700) {
      errors.push(`Panjang naskah (${words} kata) kurang dari syarat minimal 700 kata.`);
    }

    // Subheadings
    const h2Count = (contentMd.match(/^##\s+/gm) || []).length;
    if (h2Count < 3) {
      errors.push(`Jumlah subbab H2 (${h2Count}) kurang dari batas minimal 3 subbab.`);
    }

    // Keyword in first & last sentence check (ED-SEO-01)
    if (focusKeyword) {
      const cleanProse = contentMd
        .replace(/^#{1,6}\s+.*$/gm, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/\|.*?\|/g, '')
        .replace(/^[-*]\s+/gm, '')
        .trim();

      const sentences = cleanProse
        .split(/(?<=[.!?])\s+|\n+/)
        .map(s => s.trim())
        .filter(s => s.length > 15);

      if (sentences.length > 0) {
        const firstSentence = sentences[0] || '';
        const lastSentence = sentences[sentences.length - 1] || '';
        const normKw = focusKeyword.replace(/[–—]/g, '-');
        const firstNorm = firstSentence.toLowerCase().replace(/[–—]/g, '-');
        const lastNorm = lastSentence.toLowerCase().replace(/[–—]/g, '-');

        if (!firstNorm.includes(normKw)) {
          errors.push(`Focus keyword "${focusKeyword}" belum tercantum secara alami pada kalimat pertama pembukaan.`);
        }
        if (!lastNorm.includes(normKw)) {
          errors.push(`Focus keyword "${focusKeyword}" belum tercantum secara alami pada kalimat terakhir penutup.`);
        }
      }
    }
  }

  // Visual slots normalization
  const visualSlots = Array.isArray(json.visual_slots) && json.visual_slots.length > 0
    ? json.visual_slots.map((s, idx) => ({
        visual_id: s.visual_id || (idx === 0 ? 'cover_hero' : `inline_${idx}`),
        role: s.role || (idx === 0 ? 'cover_hero' : 'inline'),
        placement_anchor: s.placement_anchor || null,
        visual_intent: s.visual_intent || '',
        generation_prompt: s.generation_prompt || s.alt_text || '',
        target_dimensions: s.target_dimensions || (idx === 0 ? '1315x660' : '16:9'),
        alt_text: s.alt_text || title,
        caption: s.caption || '',
        original_url: s.original_url || null,
        is_approved: Boolean(s.is_approved)
      }))
    : [
        {
          visual_id: 'cover_hero',
          role: 'cover_hero',
          target_dimensions: '1315x660',
          alt_text: title,
          caption: `Penerapan ${focusKeyword} pada hunian modern.`,
          generation_prompt: `Realistic photo of ${focusKeyword}, modern Indonesian tropical home, natural lighting, 35mm lens.`,
          original_url: null,
          is_approved: false
        },
        {
          visual_id: 'inline_1',
          role: 'inline',
          placement_anchor: '## 1.',
          target_dimensions: '16:9',
          alt_text: `Detail ${focusKeyword}`,
          caption: `Detail visual pendukung ${focusKeyword}.`,
          generation_prompt: `Close up detail of ${focusKeyword}, crisp texture, natural light.`,
          original_url: null,
          is_approved: false
        }
      ];

  const normalizedPkg = {
    schema_version: json.schema_version || '1.0.0',
    production_id: json.production_id || defaultProductionId,
    idempotency_key: json.idempotency_key || `bridge_pkg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    revision: Number(json.revision) || 1,
    title,
    slug,
    focus_keyword: focusKeyword,
    secondary_keywords: json.secondary_keywords || [],
    search_intent: json.search_intent || 'informational',
    editorial_angle: json.editorial_angle || 'Problem Solving',
    custom_angle_notes: json.custom_angle_notes || '',
    description: description || title,
    seo_title: json.seo_title || title,
    content_md: contentMd,
    excerpt: json.excerpt || description || title,
    category_id: Number(json.category_id) || 8,
    tags: json.tags || [],
    key_takeaways: json.key_takeaways || [],
    faq: json.faq || [],
    references: json.references || [],
    schedule_intent: json.schedule_intent || null,
    visual_slots: visualSlots,
    external_source: json.external_source || {
      platform: 'chatgpt_plus',
      model: 'gpt-4o',
      captured_at: new Date().toISOString()
    }
  };

  return {
    isValid: errors.length === 0,
    pkg: normalizedPkg,
    errors,
    warnings,
    missingFields
  };
}

function parseMarkdownFallback(text, defaultProductionId) {
  // Use existing heuristic regex extraction for markdown
  let title = '';
  const h1Match = text.match(/^#\s+([^\n]+)/m);
  if (h1Match) title = h1Match[1].replace(/^["'`*]+|["'`*]+$/g, '').trim();

  let focusKeyword = '';
  const kwMatch = text.match(/(?:Focus Keyword|Kata Kunci Fokus|Fokus Kata Kunci|Keyword):\s*([^\n]+)/i);
  if (kwMatch) focusKeyword = kwMatch[1].replace(/^["'`*]+|["'`*]+$/g, '').trim().toLowerCase();

  let description = '';
  const descMatch = text.match(/(?:Meta Deskripsi|Deskripsi|Description):\s*([^\n]+)/i);
  if (descMatch) description = descMatch[1].replace(/^["'`*]+|["'`*]+$/g, '').trim();

  let cleanMd = text
    .replace(/^---[\s\S]*?---\s*/, '')
    .replace(/(?:Judul|Title|Focus Keyword|Meta Deskripsi|Kategori):[^\n]*\n/gi, '')
    .trim();

  if (title && !cleanMd.startsWith('# ')) {
    cleanMd = `# ${title}\n\n${cleanMd}`;
  }

  const jsonDraft = {
    schema_version: '1.0.0',
    production_id: defaultProductionId,
    title,
    focus_keyword: focusKeyword,
    description,
    content_md: cleanMd
  };

  return validateAndNormalizeJsonPackage(jsonDraft, defaultProductionId);
}
