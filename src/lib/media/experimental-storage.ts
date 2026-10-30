/**
 * RancangLoka — Experimental Media Candidate Storage & Ledger (MEDIA-CLOUDFLARE-AI-1)
 *
 * Keeps generated candidates strictly segregated from approved production media.
 * Enforces:
 * - approval_status defaults to PENDING_REVIEW.
 * - Zero automatic assignment to articles.featured_image.
 * - Immutable candidate provenance and byte sha256 checksums.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface ExperimentalMediaCandidate {
  id: string;
  article_id: number;
  generation_job_id: string;
  provider: string;
  model: string;
  prompt: string;
  dimensions: string;
  width: number;
  height: number;
  seed?: number;
  steps?: number;
  generation_timestamp: string;
  media_role: string;
  provenance: Record<string, any>;
  approval_status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  storage_reference: string;
  public_url: string;
  byte_size: number;
  sha256: string;
  mime_type: string;
  usage: {
    estimated_neurons: number;
    estimated_cost_usd: number;
    actual_neurons?: number;
    actual_cost_usd?: number;
    is_free_tier: boolean;
  };
  visual_brief?: any;
  geometry_qa?: any;
  subject_priority_qa?: any;
  crop_preview?: any;
  editorial_verdict?: 'APPROVED_PREFERRED' | 'REJECTED' | 'PENDING_REVIEW' | 'NEEDS_REGENERATION';
  editorial_notes?: string;
  rejection_reason?: string;
}

const STORAGE_DIR = path.resolve('./storage/experimental-media');
const PUBLIC_DIR = path.resolve('./public/experimental-media');
const MANIFEST_FILE = path.join(STORAGE_DIR, 'candidates-manifest.json');

function ensureDirectories() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
}

export function loadCandidatesLedger(): ExperimentalMediaCandidate[] {
  ensureDirectories();
  if (!fs.existsSync(MANIFEST_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(MANIFEST_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCandidatesLedger(candidates: ExperimentalMediaCandidate[]): void {
  ensureDirectories();
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(candidates, null, 2), 'utf8');
}

export function saveExperimentalCandidate(
  candidate: ExperimentalMediaCandidate,
  imageBytes: Uint8Array
): void {
  ensureDirectories();

  const extension = candidate.mime_type.includes('png') ? 'png' : 'jpg';
  const filename = `${candidate.id}.${extension}`;

  const storagePath = path.join(STORAGE_DIR, filename);
  const publicPath = path.join(PUBLIC_DIR, filename);

  // 1. Write binary to storage and public mirror
  fs.writeFileSync(storagePath, Buffer.from(imageBytes));
  fs.writeFileSync(publicPath, Buffer.from(imageBytes));

  candidate.storage_reference = `storage/experimental-media/${filename}`;
  candidate.public_url = `/experimental-media/${filename}`;

  // 2. Append or update in ledger
  const candidates = loadCandidatesLedger();
  const existingIdx = candidates.findIndex((c) => c.id === candidate.id);
  if (existingIdx >= 0) {
    candidates[existingIdx] = candidate;
  } else {
    candidates.push(candidate);
  }

  saveCandidatesLedger(candidates);
}

export function getCandidatesByArticle(articleId: number): ExperimentalMediaCandidate[] {
  const all = loadCandidatesLedger();
  return all.filter((c) => c.article_id === articleId);
}

export function updateCandidateStatus(
  id: string,
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
): ExperimentalMediaCandidate | null {
  const candidates = loadCandidatesLedger();
  const candidate = candidates.find((c) => c.id === id);
  if (!candidate) return null;

  candidate.approval_status = status;
  saveCandidatesLedger(candidates);
  return candidate;
}
