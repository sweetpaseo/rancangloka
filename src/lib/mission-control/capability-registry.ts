/**
 * RancangLoka Hermes Mission Control — Capability Registry Contract
 * Milestone: HERMES-MC-7
 *
 * Strict Invariants:
 * 1. Read-only presentation and routing contracts.
 * 2. Stable machine capability identifiers (e.g., ARTICLE_WRITING, EVIDENCE_RESEARCH).
 * 3. Machine vs presentation separation: display names are presentation-only.
 * 4. Zero arbitrary command execution: capability definitions specify strictly allowlisted command families.
 * 5. Fail-closed: unregistered or unknown capabilities evaluate safely to fallback without crashing.
 */

export type CapabilityAvailability =
  | 'NOT_AVAILABLE'
  | 'AVAILABLE_READ_ONLY'
  | 'AVAILABLE_CONTROLLED'
  | 'AVAILABLE';

export interface MissionControlCapabilityDefinition {
  capability_id: string;
  display_name: string;
  description: string;
  owning_department_id: string;
  default_agent_id: string | null;
  operational_availability: CapabilityAvailability;
  source_systems: string[];
  command_families: string[];
  read_models: string[];
  anomaly_classes: string[];
}

// Canonical capabilities baseline
const CANONICAL_CAPABILITIES: MissionControlCapabilityDefinition[] = [
  {
    capability_id: 'ARTICLE_WRITING',
    display_name: 'Penulisan Naskah Artikel',
    description: 'Penyusunan naskah editorial arsitektur dan hunian berdasar human voice layer, anti-slop, dan piramida terbalik.',
    owning_department_id: 'editorial',
    default_agent_id: 'content_writer_primary',
    operational_availability: 'AVAILABLE',
    source_systems: ['hermes_pipeline', 'd1_articles'],
    command_families: ['ARTICLE_DRAFT_REQUEST', 'ARTICLE_REWRITE_REQUEST', 'ARTICLE_STRUCTURE_REVIEW', 'EDITORIAL_COPY_REVIEW'],
    read_models: ['pipeline.tasks', 'articles'],
    anomaly_classes: ['EDITORIAL_TASK_FAILED']
  },
  {
    capability_id: 'HUMAN_WRITING_AUTHORING',
    display_name: 'Penulisan Prosa Alami Human-First',
    description: 'Penyusunan prosa editorial yang alami, lugas, mengalir, dan bebas pola klise AI generik untuk pembaca rumah Indonesia.',
    owning_department_id: 'editorial',
    default_agent_id: 'content_writer_primary',
    operational_availability: 'AVAILABLE',
    source_systems: ['hermes_pipeline', 'human_quality_gate'],
    command_families: ['HUMAN_PROSE_DRAFT_REQUEST', 'HUMAN_PROSE_REWRITE_REQUEST'],
    read_models: ['pipeline.tasks', 'articles.human_quality'],
    anomaly_classes: ['EDITORIAL_TASK_FAILED']
  },
  {
    capability_id: 'EVIDENCE_RESEARCH',
    display_name: 'Riset Bukti Teknis & SNI',
    description: 'Penelusuran standar konstruksi, pengumpulan rujukan primer, dan verifikasi kepatuhan monetary silence.',
    owning_department_id: 'research_evidence',
    default_agent_id: 'evidence_researcher_lead',
    operational_availability: 'AVAILABLE',
    source_systems: ['hermes_research', 'evidence_packs'],
    command_families: ['EVIDENCE_RESEARCH_REQUEST', 'SOURCE_REVIEW_REQUEST', 'CITATION_CHECK_REQUEST', 'EVIDENCE_GAP_ANALYSIS'],
    read_models: ['pipeline.tasks'],
    anomaly_classes: ['RESEARCH_PACK_FAILED']
  },
  {
    capability_id: 'EDITORIAL_QA',
    display_name: 'Quality Assurance Redaksional',
    description: 'Inspeksi mutu naskah, First Article Gate 13 kriteria, verifikasi foto autentik, dan kelayakan tayang.',
    owning_department_id: 'editorial',
    default_agent_id: 'editorial_qa_primary',
    operational_availability: 'AVAILABLE',
    source_systems: ['hermes_qa', 'd1_articles'],
    command_families: ['EDITORIAL_QA_REQUEST', 'REVIEW_READINESS_CHECK', 'ARTICLE_VALIDATION_REQUEST'],
    read_models: ['pipeline.tasks', 'articles.awaitingReviewCount'],
    anomaly_classes: ['EDITORIAL_GATE_FAILURE', 'EDITORIAL_TASK_FAILED']
  },
  {
    capability_id: 'HUMAN_WRITING_QA',
    display_name: 'Gerbang Mutu Penulisan Alami Redaksi',
    description: 'Evaluasi deterministik kelancaran prosa, deteksi pola tulisan mekanis/template, dan umpan balik revisi terstruktur.',
    owning_department_id: 'editorial',
    default_agent_id: 'editorial_qa_primary',
    operational_availability: 'AVAILABLE',
    source_systems: ['hermes_qa', 'human_quality_gate'],
    command_families: ['HUMAN_QUALITY_EVALUATION_REQUEST', 'EDITORIAL_NATURALNESS_REVIEW'],
    read_models: ['pipeline.tasks', 'articles.human_quality'],
    anomaly_classes: ['EDITORIAL_GATE_FAILURE']
  },
  {
    capability_id: 'EDITORIAL_NATURALNESS_REVIEW',
    display_name: 'Peninjauan Kewajaran Editorial',
    description: 'Inspeksi keharmonisan ritme kalimat, relevansi iklim lokal, dan keaslian orientasi keputusan pembaca.',
    owning_department_id: 'editorial',
    default_agent_id: 'editorial_qa_primary',
    operational_availability: 'AVAILABLE',
    source_systems: ['hermes_qa', 'human_quality_gate'],
    command_families: ['EDITORIAL_NATURALNESS_REVIEW'],
    read_models: ['pipeline.tasks', 'articles.human_quality'],
    anomaly_classes: ['EDITORIAL_GATE_FAILURE']
  },
  {
    capability_id: 'MEDIA_OPERATIONS',
    display_name: 'Operasi Visual LokaMedia',
    description: 'Generasi media visual autentik, durable retry accounting, manajemen metadata foto, dan integrasi Cloudflare R2.',
    owning_department_id: 'media',
    default_agent_id: 'lokamedia_worker_primary',
    operational_availability: 'AVAILABLE_READ_ONLY',
    source_systems: ['lokamedia_worker', 'd1_media_jobs', 'cloudflare_r2'],
    command_families: ['MEDIA_STATUS_QUERY', 'MEDIA_DIAGNOSTIC_REQUEST', 'MEDIA_TASK_REVIEW'],
    read_models: ['media', 'pipeline.tasks', 'health.mediaWorker'],
    anomaly_classes: ['MEDIA_WORKER_DISABLED', 'CIRCUIT_BREAKER_OPEN', 'MEDIA_RETRY_EXHAUSTED', 'MEDIA_STAGE_FAILURE']
  },
  {
    capability_id: 'PUBLICATION_OPERATIONS',
    display_name: 'Orkestrasi Operasi Publikasi',
    description: 'Manajemen kuota tayang harian, penegakan safety envelope, atomic dispatch, audit receipt Cloudflare D1.',
    owning_department_id: 'publication_operations',
    default_agent_id: 'publication_dispatcher_core',
    operational_availability: 'AVAILABLE_READ_ONLY',
    source_systems: ['publication_engine', 'cloudflare_cron', 'd1_receipts', 'automation_control'],
    command_families: ['PUBLICATION_STATUS_QUERY', 'PUBLICATION_PLAN_REVIEW', 'SCHEDULER_DIAGNOSTIC'],
    read_models: ['scheduler', 'd1_receipts', 'health.automation'],
    anomaly_classes: ['EMERGENCY_KILL_SWITCH_ACTIVE', 'CIRCUIT_BREAKER_OPEN', 'CRON_JOB_FAILED', 'AUTOMATION_MODE_OFF']
  },
  {
    capability_id: 'SYSTEM_TELEMETRY',
    display_name: 'Observabilitas Sistem & JEV',
    description: 'Monitoring telemetri edge runtime, evaluasi model keputusan TypeSafe Jev bayangan (shadow-only, zero authority).',
    owning_department_id: 'engineering_telemetry',
    default_agent_id: 'telemetry_observer_jev',
    operational_availability: 'AVAILABLE_READ_ONLY',
    source_systems: ['typesafe_jev', 'edge_runtime', 'd1_observations'],
    command_families: ['SYSTEM_HEALTH_QUERY', 'JEV_OBSERVATION_REVIEW', 'TELEMETRY_DIAGNOSTIC', 'CIRCUIT_BREAKER_STATUS_QUERY'],
    read_models: ['health', 'jev', 'activity'],
    anomaly_classes: ['JEV_PROVIDER_UNREACHABLE', 'JEV_PROVIDER_FALLBACK', 'CIRCUIT_BREAKER_OPEN', 'SCHEDULER_HEARTBEAT_STALE', 'SCHEDULER_HEARTBEAT_OFFLINE']
  },
  {
    capability_id: 'SOCIAL_DISTRIBUTION',
    display_name: 'Distribusi Sosial & Multi-Kanal',
    description: 'Kapasitas masa depan untuk sindikasi konten media sosial (saat ini belum tersedia runtime / unstaffed).',
    owning_department_id: 'social',
    default_agent_id: null,
    operational_availability: 'NOT_AVAILABLE',
    source_systems: ['future_social_bridge'],
    command_families: [],
    read_models: [],
    anomaly_classes: []
  },
  {
    capability_id: 'MANAGEMENT_DECISION_ADVISORY',
    display_name: 'Advisori Keputusan Manajemen & Mitigasi Risiko',
    description: 'Advisori pertimbangan keputusan strategis berbasis evaluasi TypeSafe JEV (strictly advisory, zero execution authority).',
    owning_department_id: 'management',
    default_agent_id: 'management_advisor_jefry',
    operational_availability: 'AVAILABLE_READ_ONLY',
    source_systems: ['typesafe_jev', 'd1_observations'],
    command_families: [],
    read_models: ['jev', 'health'],
    anomaly_classes: []
  }
];

// In-memory dynamic capabilities store
let capabilityRegistry: Map<string, MissionControlCapabilityDefinition> = new Map(
  CANONICAL_CAPABILITIES.map((c) => [c.capability_id, { ...c }])
);

/**
 * Register a new capability dynamically into Mission Control.
 * Throws if duplicate capability_id is passed with different owning configuration.
 */
export function registerCapability(definition: MissionControlCapabilityDefinition): void {
  if (!definition || !definition.capability_id) {
    throw new Error('[CapabilityRegistry] Capability registration requires a valid capability_id');
  }

  const existing = capabilityRegistry.get(definition.capability_id);
  if (existing) {
    throw new Error(`[CapabilityRegistry] Capability with ID '${definition.capability_id}' is already registered.`);
  }

  capabilityRegistry.set(definition.capability_id, { ...definition });
}

/**
 * Update an existing capability definition dynamically.
 * Throws if capability is not found.
 */
export function updateCapability(
  capabilityId: string,
  updates: Partial<MissionControlCapabilityDefinition>
): MissionControlCapabilityDefinition {
  const existing = capabilityRegistry.get(capabilityId);
  if (!existing) {
    throw new Error(`[CapabilityRegistry] Capability with ID '${capabilityId}' not found.`);
  }

  const updated: MissionControlCapabilityDefinition = {
    ...existing,
    ...updates,
    capability_id: existing.capability_id // Immutable key
  };

  capabilityRegistry.set(capabilityId, updated);
  return updated;
}

/**
 * Unregister a capability (primarily used in tests).
 */
export function unregisterCapability(capabilityId: string): boolean {
  return capabilityRegistry.delete(capabilityId);
}

/**
 * Reset capability registry to canonical baseline.
 */
export function resetCapabilityRegistry(): void {
  capabilityRegistry = new Map(CANONICAL_CAPABILITIES.map((c) => [c.capability_id, { ...c }]));
}

/**
 * Retrieve all registered capabilities.
 */
export function getRegisteredCapabilities(): MissionControlCapabilityDefinition[] {
  return Array.from(capabilityRegistry.values());
}

/**
 * Look up a capability by its machine identifier.
 */
export function getCapabilityDefinition(capabilityId: string): MissionControlCapabilityDefinition | null {
  return capabilityRegistry.get(capabilityId) || null;
}

/**
 * Retrieve all capabilities owned by a specific department.
 */
export function getCapabilitiesByDepartment(departmentId: string): MissionControlCapabilityDefinition[] {
  return Array.from(capabilityRegistry.values()).filter((c) => c.owning_department_id === departmentId);
}

/**
 * Resolve allowlisted command families associated with a set of capability IDs.
 */
export function resolveCommandFamiliesForCapabilities(capabilityIds: string[]): string[] {
  const families = new Set<string>();
  for (const cid of capabilityIds) {
    const def = capabilityRegistry.get(cid);
    if (def && Array.isArray(def.command_families)) {
      for (const cmd of def.command_families) {
        families.add(cmd);
      }
    }
  }
  return Array.from(families);
}

/**
 * Resolve which department and responsible agent own a specific capability.
 */
export function resolveCapabilityOwnership(capabilityId: string): {
  department_id: string | null;
  responsible_agent_id: string | null;
  operational_availability: CapabilityAvailability;
} {
  const def = capabilityRegistry.get(capabilityId);
  if (!def) {
    return {
      department_id: null,
      responsible_agent_id: null,
      operational_availability: 'NOT_AVAILABLE'
    };
  }

  return {
    department_id: def.owning_department_id,
    responsible_agent_id: def.default_agent_id,
    operational_availability: def.operational_availability
  };
}

/**
 * Canonical Social Department Capabilities (Milestone: SOCIAL-S2)
 * Strictly read-only / shadow mode, zero execution or external publishing authority.
 */
export const CANONICAL_SOCIAL_CAPABILITIES: MissionControlCapabilityDefinition[] = [
  {
    capability_id: 'SOCIAL_DISTRIBUTION',
    display_name: 'Distribusi Media Sosial (Shadow)',
    description: 'Pemantauan sindikasi konten multi-kanal ke media sosial (strictly read-only / shadow, zero publishing authority).',
    owning_department_id: 'social',
    default_agent_id: 'social_distribution_operator',
    operational_availability: 'AVAILABLE_READ_ONLY',
    source_systems: ['social_campaigns', 'social_staging_outbox'],
    command_families: ['SOCIAL_STATUS_QUERY', 'SOCIAL_CAMPAIGN_REVIEW', 'SOCIAL_OUTBOX_REVIEW', 'SOCIAL_ADAPTER_QUERY', 'SOCIAL_CONNECTION_QUERY'],
    read_models: ['social', 'social.counts'],
    anomaly_classes: ['SOCIAL_CAMPAIGN_BLOCKED', 'SOCIAL_DUPLICATE_POST_RISK', 'SOCIAL_APPROVAL_MISMATCH', 'SOCIAL_VARIANT_BLOCKED', 'SOCIAL_AUTOMATION_OFF', 'SOCIAL_AUTH_ERROR', 'SOCIAL_RATE_LIMIT', 'SOCIAL_MEDIA_REJECTED', 'SOCIAL_AUTH_REAUTH_REQUIRED', 'SOCIAL_PERMISSION_INCOMPLETE', 'SOCIAL_ACCOUNT_BINDING_INVALID']
  },
  {
    capability_id: 'SOCIAL_COPY_WRITING',
    display_name: 'Penulisan Copy Medsos',
    description: 'Penyusunan caption, hook, dan teks pendukung posting media sosial berbasis human voice layer.',
    owning_department_id: 'social',
    default_agent_id: 'social_distribution_operator',
    operational_availability: 'AVAILABLE_READ_ONLY',
    source_systems: ['social_post_variants'],
    command_families: ['SOCIAL_COPY_REVIEW'],
    read_models: ['social.variants'],
    anomaly_classes: ['SOCIAL_VARIANT_BLOCKED']
  },
  {
    capability_id: 'CAROUSEL_CURATION',
    display_name: 'Kurasi Media & Carousel',
    description: 'Kurasi tata letak visual slide carousel, foto arsitektur autentik, dan urutan slide gambar.',
    owning_department_id: 'social',
    default_agent_id: 'social_distribution_operator',
    operational_availability: 'AVAILABLE_READ_ONLY',
    source_systems: ['social_post_variants', 'cloudflare_r2'],
    command_families: ['CAROUSEL_LAYOUT_REVIEW'],
    read_models: ['social.variants'],
    anomaly_classes: ['SOCIAL_MEDIA_MISMATCH']
  },
  {
    capability_id: 'SOCIAL_QA_SUPPORT',
    display_name: 'Dukungan QA Konten Sosial',
    description: 'Verifikasi kesesuaian hashtag, link attribution, dan kepatuhan redaksional konten sosial.',
    owning_department_id: 'social',
    default_agent_id: 'social_distribution_operator',
    operational_availability: 'AVAILABLE_READ_ONLY',
    source_systems: ['social_post_variants', 'social_variant_approvals'],
    command_families: ['SOCIAL_QA_STATUS_QUERY'],
    read_models: ['social.approvals'],
    anomaly_classes: ['SOCIAL_APPROVAL_MISMATCH']
  },
  {
    capability_id: 'SOCIAL_SCHEDULING_OBSERVATION',
    display_name: 'Observasi Jadwal Outbox Sosial',
    description: 'Pemantauan antrean outbox posting terjadwal (zero dispatch authority saat SOCIAL_AUTOMATION=OFF).',
    owning_department_id: 'social',
    default_agent_id: 'social_distribution_operator',
    operational_availability: 'AVAILABLE_READ_ONLY',
    source_systems: ['social_staging_outbox'],
    command_families: ['SOCIAL_OUTBOX_REVIEW'],
    read_models: ['social.outbox'],
    anomaly_classes: ['SOCIAL_OUTBOX_INCONSISTENCY']
  }
];

