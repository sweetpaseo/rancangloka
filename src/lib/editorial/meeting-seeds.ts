/**
 * RancangLoka — Historical Staff Meetings Seeder & Reconciliation
 * File: src/lib/editorial/meeting-seeds.ts
 * Milestone: OLCI-MEETING-MINUTES-V1
 *
 * Reconciles historical meetings (MEETING-OLCI-MWWAMSP9 and COLLAB-10030-BUDI-IRWAN)
 * into the canonical 08-meeting-minutes repository with strict provenance integrity.
 */

import { saveMeetingRecord, getMeetingRecord } from './meeting-manager.ts';
import type { StaffMeetingRecord } from './meeting-contracts.ts';

/**
 * Reconciles and persists historical meeting records if not already present.
 */
export async function seedHistoricalMeetingRecords(d1Db?: any): Promise<{ seeded: number }> {
  let count = 0;

  // 1. Reconcile MEETING-OLCI-MWWAMSP9 (Dry-Run Strategic Coordination)
  const existingMsp9 = getMeetingRecord('MEETING-OLCI-MWWAMSP9');
  if (!existingMsp9) {
    const meetingMsp9: StaffMeetingRecord = {
      meeting_id: 'MEETING-OLCI-MWWAMSP9',
      title: 'Rapat Koordinasi Redaksi: Penyelesaian Kelaparan Kategori Eksterior & Lanskap dan Pengendalian Dominansi Kategori Interior',
      meeting_type: 'EDITORIAL_COORDINATION',
      meeting_trigger: 'Owner Strategic Correction & Temuan Ketimpangan Intra-Kategori (Dapur 50%) dan Starvasi Kategori 7 Eksterior & Lanskap (0%)',
      initiator_id: 'maya',
      initiator_name: 'Maya',
      chair_id: 'maya',
      chair_name: 'Maya (Head of Content Strategy & Planning)',
      participants: [
        { id: 'maya', name: 'Maya', role: 'Head of Content Strategy & Planning', department: 'content_strategy', is_chair: true },
        { id: 'seon', name: 'SEON', role: 'SEO & Search Intent Specialist', department: 'seo' },
        { id: 'irwan', name: 'Irwan', role: 'Research & Evidence Lead', department: 'research' },
        { id: 'joko', name: 'Joko', role: 'Content Writer (Primary Author)', department: 'editorial' }
      ],
      related_staff_roles: ['content_strategy_primary', 'seo_specialist_primary', 'researcher_primary', 'content_writer_primary'],
      meeting_date: '2026-11-25',
      actual_start_at: '2026-11-25T15:43:42.285Z',
      actual_end_at: '2026-11-25T15:43:42.302Z',
      actual_duration_seconds: 1, // Delta singkat dalam siklus uji coba dry-run
      agenda: [
        'Penyelesaian Kelaparan Kategori Eksterior & Lanskap (0% dalam 21 artikel terbit)',
        'Pengendalian Rem Dominansi Kategori 1 Interior (38.1%) & Subkategori Dapur (50% internal)',
        'Penetapan Prioritas Backlog Produksi Berdasarkan Audited EPIS Score',
        'Penugasan Alur Kerja Lintas Staf untuk Day 4-A Patio Kerikil'
      ],
      objectives: [
        'Mencapai konsensus redaksi atas prioritas backlog berikutnya',
        'Menyetujui moratorium pendingin sementara untuk subkategori Dapur',
        'Mendelegasikan riset standar SNI/ASTM kepada Irwan dan kesiapan menulis kepada Joko'
      ],
      issues_raised: [
        'Portofolio RancangLoka memiliki lubang besar: 0 artikel pada Kategori Eksterior & Lanskap',
        'Subkategori Dapur mengalami kejenuhan internal (4 dari 8 artikel interior adalah dapur)'
      ],
      staff_complaints: [
        'Irwan menyampaikan perlunya kejelasan lingkup klaim teknis sebelum riset dimulai agar tidak terjadi revisi berulang di tahap QA.',
        'Joko mengingatkan bahwa topik teknis luar ruang membutuhkan contoh aplikatif pekarangan rumah tropis yang akrab agar pembaca tidak merasa membaca buku teks sipil.'
      ],
      findings: [
        'Day 4-A (Patio Kerikil) menduduki peringkat #1 dengan skor EPIS 94.00 (STARVED)',
        'Day 5-A (Plafon Drop Ceiling) berada di Kategori Interior yang berstatus DOMINANT sehingga menerima rem pendingin EPIS'
      ],
      supporting_evidence: [
        'Data Inventaris D1: 21 artikel terbit (8 Interior, 5 Arsitektur, 2 Material, 1 Smart Home, 1 Kenyamanan, 0 Eksterior)',
        'Receipt Kanonikal: RECEIPT-MAYA-MWWAMSPQ',
        'Catatan Second Brain Maya: EXP-MAYA-20261125-02-STAFF-MEETING.md'
      ],
      individual_contributions: [
        {
          staff_id: 'maya',
          staff_name: 'Maya',
          role: 'Head of Content Strategy & Planning',
          department_id: 'content_strategy',
          statement_summary: 'Memaparkan hasil audit EPIS dan menyoroti darurat diversifikasi portofolio untuk Kategori 7 Eksterior & Lanskap.',
          reported_findings: ['Kategori 7 memiliki 0 artikel', 'Subkategori Dapur mendominasi 50% interior'],
          suggestions_proposed: ['Jalankan Day 4-A Patio Kerikil sebagai prioritas utama', 'Terapkan rem moratorium sementara pada topik dapur baru']
        },
        {
          staff_id: 'seon',
          staff_name: 'SEON',
          role: 'SEO & Search Intent Specialist',
          department_id: 'seo',
          statement_summary: 'Mengonfirmasi bahwa kueri "patio kerikil taman belakang" memiliki search intent praktis yang sangat kuat dan relevansi tinggi bagi pemilik rumah.',
          suggestions_proposed: ['Gunakan keyword berbobot intent tinggi dan hindari kanibalisasi kata kunci']
        },
        {
          staff_id: 'irwan',
          staff_name: 'Irwan',
          role: 'Research & Evidence Lead',
          department_id: 'research',
          statement_summary: 'Menyanggupi penyusunan Evidence Pack dengan rujukan standar drainase SNI dan membran geotekstil ASTM.',
          complaints_raised: ['Spesifikasi teknis material kerikil harus diverifikasi batas ketebalannya agar pembaca tidak salah beli material']
        },
        {
          staff_id: 'joko',
          staff_name: 'Joko',
          role: 'Content Writer (Primary Author)',
          department_id: 'editorial',
          statement_summary: 'Menyepakati jadwal penulisan narasi berpanduan L4 Santai Berisi begitu Evidence Pack diterbitkan oleh Irwan.',
          concerns_or_disagreements: ['Menegaskan bahwa istilah teknis geotekstil harus dijelaskan dengan analogi kain penyaring agar mudah dipahami awam']
        }
      ],
      suggestions: [
        'Kombinasikan agregat batu split dan koral sikat dengan pembatas bata merah agar hamparan rapi.',
        'Gunakan rem pendingin dinamis yang otomatis terangkat saat proporsi kategori seimbang.'
      ],
      disagreements: [
        'Sempat terjadi perdebatan apakah topik plafon (Day 5-A) harus diselesaikan terlebih dahulu; disepakati bahwa kebutuhan diversifikasi eksterior jauh lebih mendesak.'
      ],
      discussion_summary: 'Rapat berlangsung secara konstruktif dan mencapai konsensus bulat untuk mengutamakan Day 4-A Patio Kerikil sebagai penugasan aktif berikutnya serta menetapkan moratorium sementara pada topik Dapur di Kategori Interior.',
      decisions: [
        {
          decision_id: 'DEC-MWWAMSP9-01',
          meeting_id: 'MEETING-OLCI-MWWAMSP9',
          title: 'Penetapan Day 4-A (Patio Kerikil) sebagai Prioritas Produksi #1',
          decision_text: 'Topik Day 4-A (Panduan Membuat Patio Kerikil Koral Sikat dan Batu Split untuk Taman Belakang) resmi ditetapkan sebagai penugasan produksi aktif berikutnya untuk mengisi kelaparan Kategori 7 Eksterior & Lanskap.',
          rationale: 'Kategori 7 berstatus STARVED (0 artikel, 0.0%) dengan skor EPIS tertinggi (94.00). Keterlambatan produksi akan memperparah ketimpangan portofolio media.',
          authority_role: 'Head of Content Strategy & Planning',
          authority_type: 'STAFF_AUTONOMOUS',
          status: 'ADOPTED',
          related_action_ids: ['ACT-MWWAMSP9-01', 'ACT-MWWAMSP9-02', 'ACT-MWWAMSP9-03'],
          decided_at: '2026-11-25T15:43:42.290Z'
        },
        {
          decision_id: 'DEC-MWWAMSP9-02',
          meeting_id: 'MEETING-OLCI-MWWAMSP9',
          title: 'Pemberlakuan Rem Pendingin Dinamis (Moratorium Sementara) Topik Dapur',
          decision_text: 'Menunda penambahan topik bertema Dapur baru di Kategori 1 Interior hingga kuota artikel untuk Kamar Tidur dan Kamar Mandi terisi seimbang.',
          rationale: 'Subkategori Dapur menyerap 4 dari 8 artikel (50.0%) di Kategori Interior, memicu risiko kanibalisasi topik dan kejenuhan pembaca.',
          authority_role: 'Head of Content Strategy & Planning',
          authority_type: 'STAFF_AUTONOMOUS',
          status: 'ADOPTED',
          related_action_ids: [],
          decided_at: '2026-11-25T15:43:42.292Z'
        }
      ],
      action_items: [
        {
          action_id: 'ACT-MWWAMSP9-01',
          meeting_id: 'MEETING-OLCI-MWWAMSP9',
          description: 'Penyusunan Evidence Pack standar SNI 03-2453-2002 dan ASTM D4632/D4751 untuk Day 4-A',
          responsible_staff_id: 'irwan',
          responsible_staff_name: 'Irwan',
          related_task_id: 'TASK-DAY4A-RESEARCH',
          related_article_ref: 'panduan-membuat-patio-kerikil-taman-belakang-rumah',
          status: 'COMPLETED',
          created_at: '2026-11-25T15:43:42.295Z',
          completed_at: '2026-11-25T16:06:25.000Z',
          completion_evidence: 'storage/masters/art10034/evidence_pack.json',
          result_summary: 'Evidence Pack selesai dengan verifikasi SNI drainase pekarangan dan geotekstil non-woven.'
        },
        {
          action_id: 'ACT-MWWAMSP9-02',
          meeting_id: 'MEETING-OLCI-MWWAMSP9',
          description: 'Validasi Keyword dan Search Intent untuk kueri "patio kerikil taman belakang"',
          responsible_staff_id: 'seon',
          responsible_staff_name: 'SEON',
          related_task_id: 'TASK-DAY4A-SEO',
          related_article_ref: 'panduan-membuat-patio-kerikil-taman-belakang-rumah',
          status: 'COMPLETED',
          created_at: '2026-11-25T15:43:42.296Z',
          completed_at: '2026-11-25T16:06:25.000Z',
          completion_evidence: 'seon-intent-engine-check-pass',
          result_summary: 'Focus keyword tervalidasi dengan search intent practical how-to yang kuat.'
        },
        {
          action_id: 'ACT-MWWAMSP9-03',
          meeting_id: 'MEETING-OLCI-MWWAMSP9',
          description: 'Penulisan naskah orisinal L4 Santai Berisi untuk Artikel #10034',
          responsible_staff_id: 'joko',
          responsible_staff_name: 'Joko',
          related_task_id: 'TASK-DAY4A-WRITING',
          related_article_ref: 'panduan-membuat-patio-kerikil-taman-belakang-rumah',
          status: 'COMPLETED',
          created_at: '2026-11-25T15:43:42.298Z',
          completed_at: '2026-11-25T16:07:30.000Z',
          completion_evidence: 'storage/masters/art10034/genuine_joko_raw_output.md',
          result_summary: 'Naskah 1.259 kata selesai dan dievaluasi Nadia dengan skor 78/100.'
        }
      ],
      unresolved_issues: [
        'Kebutuhan integrasi data kuantitatif Google Search Console & GA4 nyata (saat ini masih berlabel PROVISIONAL_HYPOTHESIS_V1)'
      ],
      learning_outcomes: [
        {
          learning_id: 'LRN-MWWAMSP9-01',
          target_staff_id: 'maya',
          domain: 'content_strategy',
          insight: 'Pemerataan multi-level mencegah kejenuhan pembaca dan membangun topical authority menyeluruh di seluruh elemen bangunan.',
          actionable_guidance: 'Pantau persentase subkategori agar tidak ada subkategori tunggal yang menyerap >40% dari kuota kategori induknya.',
          stored_in_memory_ref: 'EXP-MAYA-20261125-02-STAFF-MEETING.md'
        }
      ],
      related_tasks: ['TASK-DAY4A-RESEARCH', 'TASK-DAY4A-WRITING'],
      related_articles: ['panduan-membuat-patio-kerikil-taman-belakang-rumah'],
      related_memory_records: ['EXP-MAYA-20261125-02-STAFF-MEETING.md', 'EXP-MAYA-20261125-03-MULTI-LEVEL-AND-EPIS-CORRECTION.md'],
      meeting_status: 'COMPLETED',
      provenance: 'DRY_RUN', // Sesuai arahan Owner: pertahankan label dry-run secara jujur
      created_at: '2026-11-25T15:43:42.285Z',
      updated_at: '2026-11-25T16:15:00.000Z',
      revision_history: [
        {
          revised_at: '2026-11-25T16:15:00.000Z',
          revised_by: 'Gravy',
          reason: 'Rekonsiliasi histori pertemuan kanonis dari receipt RECEIPT-MAYA-MWWAMSPQ dan Second Brain Maya sesuai mandat OLCI-MEETING-MINUTES-V1.'
        }
      ]
    };

    await saveMeetingRecord(meetingMsp9, d1Db);
    count++;
  }

  // 2. Reconcile COLLAB-10030-BUDI-IRWAN (Historical Reconstruction from Async Collaboration Thread)
  const existingCollab = getMeetingRecord('MEETING-OLCI-COLLAB-10030');
  if (!existingCollab || existingCollab.provenance === 'REAL_RUNTIME' || existingCollab.actual_duration_seconds !== null) {
    const meetingCollab: StaffMeetingRecord = {
      meeting_id: 'MEETING-OLCI-COLLAB-10030',
      title: 'Rapat Evaluasi Cacat Visual Smart Lock #10030: Investigasi Mandiri Budi & Klarifikasi Standar Teknis Irwan',
      meeting_type: 'INCIDENT_POSTMORTEM',
      meeting_trigger: 'Owner Feedback on Article #10030 Visual Realism: Several smart lock illustrations appear technically unrealistic and visually incorrect.',
      initiator_id: 'budi',
      initiator_name: 'Budi (Media Director)',
      chair_id: 'budi',
      chair_name: 'Budi (Media Director)',
      participants: [
        { id: 'budi', name: 'Budi', role: 'Media Director & Visual Producer', department: 'media', is_chair: true },
        { id: 'irwan', name: 'Irwan', role: 'Research & Evidence Lead', department: 'research' }
      ],
      related_staff_roles: ['media_director_primary', 'researcher_primary'],
      meeting_date: '2026-11-25',
      actual_start_at: '2026-11-25T08:20:39.139Z',
      actual_end_at: '2026-11-25T08:20:39.139Z',
      actual_duration_seconds: null, // Tanpa event timer rapat sinkron (Rekonstruksi Dokumen Asinkron)
      agenda: [
        'Investigasi Mandiri Cacat Visual pada 4 Gambar Smart Lock #10030',
        'Klarifikasi Standar ANSI/BHMA A156.13 vs A156.36 untuk Mortise Lockset',
        'Koreksi Anatomi Cassette Tersembunyi vs Faceplate dan Escutcheon',
        'Penyusunan Solusi Gambar Baru Berbasis Object-First Realism'
      ],
      objectives: [
        'Menemukan akar masalah kegagalan prompt difusi visual smart lock',
        'Menghilangkan asumsi spesifikasi model yang keliru diperlakukan sebagai standar universal',
        'Menyusun panduan prompt realistis baru yang disepakati Budi dan Irwan'
      ],
      issues_raised: [
        'Prompt meminta cassette bodi mortise terlihat tembus pada daun pintu yang terpasang utuh',
        'Prompt meminta terlalu banyak detail mikro dalam satu frame (port USB-C, powerbank, anak kunci, LED)',
        'Klaim Grade ANSI dan material SUS304 dicampuradukkan antara faceplate dan mekanisme'
      ],
      staff_complaints: [
        'Budi mengeluhkan bahwa deskripsi visual sebelumnya memaksakan fitur spesifik tanpa rujukan bentuk produk acuan yang jelas, sehingga model difusi mengarang posisi silinder dan sensor.',
        'Irwan mengingatkan agar deskripsi prompt tidak mengklaim sertifikasi rating IP atau grade keamanan dari penampilan luar foto.'
      ],
      findings: [
        'Cassette mortise tersembunyi di dalam kantong stile daun pintu; yang terlihat di tepi hanya faceplate dan deadbolt.',
        'Standar ANSI/BHMA A156.13 adalah acuan kinerja mortise lock, sedangkan A156.36 untuk auxiliary lock.',
        'Model generatif membutuhkan pemisahan bidang kamera (tampak muka vs tampak tepi) agar tidak memicu distorsi geometris.'
      ],
      supporting_evidence: [
        'Dokumen Standar ANSI/BHMA A156.13 & A156.36',
        'File Kolaborasi: docs/shared-memory/07-collaboration-threads/COLLAB-10030-BUDI-IRWAN.md',
        'Feedback Evaluasi Owner atas Draf Artikel #10030'
      ],
      individual_contributions: [
        {
          staff_id: 'budi',
          staff_name: 'Budi',
          role: 'Media Director',
          department_id: 'media',
          statement_summary: 'Mengakui bahwa prompt menumpuk terlalu banyak detail teknis yang belum terverifikasi dan meminta klarifikasi anatomi kunci kepada Irwan.',
          reported_findings: ['Prompt meminta bodi mortise terlihat sekaligus pada pintu tertutup', 'Port USB-C dan powerbank tidak memiliki dudukan wajar'],
          complaints_raised: ['Model difusi AI tidak bisa membaca klaim verbal abstrak menjadi bentuk visual yang konsisten tanpa panduan sudut kamera yang jelas']
        },
        {
          staff_id: 'irwan',
          staff_name: 'Irwan',
          role: 'Research & Evidence Lead',
          department_id: 'research',
          statement_summary: 'Memberikan rincian anatomi fisik presisi (cassette, stile, faceplate, escutcheon) dan membatasi klaim universal.',
          suggestions_proposed: ['Pisahkan perspektif foto eksterior dari foto tepi pintu', 'Gunakan pintu solid-core 44–45 mm sebagai contoh visual realistis']
        }
      ],
      suggestions: [
        'Gunakan pendekatan Object-First Visual Policy dengan Native 1K.',
        'Pisahkan foto tampak muka (escutcheon & handle) dari foto makro tepi daun pintu (faceplate & bolt).'
      ],
      disagreements: [
        'Perbedaan awal mengenai apakah klaim SUS304 berlaku untuk seluruh bodi; disepakati bahwa hanya faceplate yang dapat dipastikan berbahan tersebut.'
      ],
      discussion_summary: 'Budi dan Irwan membedah secara mendalam kegagalan prompt lama dan menyepakati 5 panduan solutif baru yang menjadi fondasi keberhasilan Cover Hero v3 dan gambar inline yang akhirnya diterima penuh oleh Owner.',
      decisions: [
        {
          decision_id: 'DEC-COLLAB10030-01',
          meeting_id: 'MEETING-OLCI-COLLAB-10030',
          title: 'Adopsi Pemisahan Perspektif Spasial untuk Media Visual Arsitektur',
          decision_text: 'Dilarang meminta komponen tersembunyi (seperti cassette mortise di dalam kayu) terlihat bersamaan dengan permukaan luar pintu tanpa potongan diagram eksplisit.',
          rationale: 'Memaksa model difusi menampilkan objek tersembunyi menyebabkan distorsi geometri parah dan melanggar prinsip kebenaran teknis RancangLoka.',
          authority_role: 'Media Director',
          authority_type: 'STAFF_AUTONOMOUS',
          status: 'ADOPTED',
          related_action_ids: ['ACT-COLLAB10030-01', 'ACT-COLLAB10030-02'],
          decided_at: '2026-11-25T08:44:00.000Z'
        }
      ],
      action_items: [
        {
          action_id: 'ACT-COLLAB10030-01',
          meeting_id: 'MEETING-OLCI-COLLAB-10030',
          description: 'Penyusunan ulang prompt 4 slot gambar Smart Lock #10030 berbasis pemisahan sudut pandang',
          responsible_staff_id: 'budi',
          responsible_staff_name: 'Budi',
          related_task_id: 'TASK-10030-PROMPT-REVISION',
          related_article_ref: '10030',
          status: 'COMPLETED',
          created_at: '2026-11-25T08:44:30.000Z',
          completed_at: '2026-11-25T11:30:00.000Z',
          completion_evidence: 'storage/masters/art10030/prompt_revision_v2.json',
          result_summary: 'Prompt baru berhasil disusun dan menghasilkan visual yang realistis.'
        },
        {
          action_id: 'ACT-COLLAB10030-02',
          meeting_id: 'MEETING-OLCI-COLLAB-10030',
          description: 'Pencatatan pelajaran anatomi kunci ke dalam memori profesional Budi dan Irwan',
          responsible_staff_id: 'budi',
          responsible_staff_name: 'Budi',
          related_task_id: 'TASK-10030-OLCI-LOG',
          related_article_ref: '10030',
          status: 'COMPLETED',
          created_at: '2026-11-25T08:45:00.000Z',
          completed_at: '2026-11-25T11:40:00.000Z',
          completion_evidence: 'docs/shared-memory/06-staff-memory/budi-media-director/EXP-BUDI-10030-01.md',
          result_summary: 'Pengalaman tercatat resmi di Second Brain Budi.'
        }
      ],
      unresolved_issues: [],
      learning_outcomes: [
        {
          learning_id: 'LRN-COLLAB10030-01',
          target_staff_id: 'budi',
          domain: 'visual_media',
          insight: 'Prompt yang terlalu padat dengan objek mikro memicu halusinasi difusi; kesederhanaan dan fokus subjek tunggal menghasilkan realisme tertinggi.',
          actionable_guidance: 'Fokuskan 1 gambar pada 1 aspek teknis utama dengan sudut kamera alami.',
          validation_status: 'VALIDATED_EXPERIENCE',
          stored_in_memory_ref: 'docs/shared-memory/06-staff-memory/budi-media-director/EXP-BUDI-10030-01.md'
        }
      ],
      related_tasks: ['TASK-10030-PROMPT-REVISION', 'TASK-10030-OLCI-LOG'],
      related_articles: ['panduan-memilih-smart-lock-pintu-utama-rumah'],
      related_memory_records: ['docs/shared-memory/07-collaboration-threads/COLLAB-10030-BUDI-IRWAN.md'],
      meeting_status: 'COMPLETED',
      provenance: 'HISTORICAL_RECONSTRUCTION',
      created_at: '2026-11-25T08:20:39.139Z',
      updated_at: '2026-11-25T23:55:00.000Z',
      revision_history: [
        {
          revised_at: '2026-11-25T23:55:00.000Z',
          revised_by: 'Gravy',
          reason: 'Koreksi provenance dari REAL_RUNTIME menjadi HISTORICAL_RECONSTRUCTION dan durasi menjadi null per arahan Owner Directive OLCI-MEETING-MINUTES-V1 (rekonstruksi dari COLLAB-10030-BUDI-IRWAN.md tanpa trace rapat sinkron).'
        }
      ]
    };

    await saveMeetingRecord(meetingCollab, d1Db);
    count++;
  }

  return { seeded: count };
}
