/**
 * LokaBridge Studio — Master Workstation Controller & UI
 * File: extensions/lokamedia/src/bridge/bridge-ui.js
 *
 * Implements the complete LokaBridge Studio Experience in the Chrome Side Panel:
 * 1. Brief Builder (Presets & Owner Custom Angle, Keyword Preflight, Cannibalization check)
 * 2. Dynamic Prompt Builder (Modular hierarchical assembly, 1-click copy & insert)
 * 3. Content Package Parser & Smart Repair (Clipboard structured JSON, error diagnosis, targeted repair)
 * 4. Visual Production Manager (1315x660 cover, 16:9 inlines, prompt/capture/upload/approve)
 * 5. Jobs Dashboard (Real-time pipelines, per-asset progress, Reader Preview, concurrent session start)
 * 6. Production History, Publication Calendar (Asia/Jakarta), and Notifications
 */

import { BridgeApiClient } from './bridge-api.js';
import {
  parseStructuredEditorialPackage,
  stripCodeFences
} from './bridge-parser.js';
import {
  buildArticlePrompt,
  buildVisualPrompt,
  buildSmartRepairPrompt,
  PROMPT_VERSION
} from './bridge-prompt-builder.js';
import {
  saveSession,
  getSession,
  listSessions,
  deleteSession,
  saveCustomAngle,
  listCustomAngles,
  addNotification,
  listNotifications,
  markNotificationRead
} from './bridge-storage.js';

export class BridgeUiManager {
  constructor({ container, apiClient, storage }) {
    this.container = container;
    this.api = apiClient;
    this.storage = storage;

    // Active Workstation State
    this.activeTab = 'brief'; // 'brief' | 'content' | 'visual' | 'jobs' | 'history' | 'calendar' | 'notifications' | 'settings'
    this.productionId = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.brief = {
      topic: '',
      focusKeyword: '',
      secondaryKeywords: '',
      angle: 'Problem Solving',
      customAngleNotes: '',
      referenceUrls: '',
      referenceText: '',
      targetAudience: 'Pemilik rumah tinggal tropis di Indonesia',
      category: 'Material & Struktur',
      provider: 'chatgpt_plus',
      scheduleDate: '',
      scheduleTime: '10:00'
    };

    this.editorialContext = null;
    this.activePackage = null;
    this.validationErrors = [];
    this.validationWarnings = [];
    this.visualSlots = [
      {
        visual_id: 'cover_hero',
        role: 'cover_hero',
        target_dimensions: '1315x660',
        alt_text: '',
        caption: '',
        generation_prompt: '',
        original_url: null,
        is_approved: false
      },
      {
        visual_id: 'inline_1',
        role: 'inline',
        placement_anchor: '## 1.',
        target_dimensions: '16:9',
        alt_text: '',
        caption: '',
        generation_prompt: '',
        original_url: null,
        is_approved: false
      }
    ];

    this.currentJob = null;
    this.jobPollTimer = null;
    this.unreadNotifCount = 0;
  }

  async init() {
    this.render();
    this.bindGlobalEvents();
    await this.loadInitialData();
  }

  async loadInitialData() {
    try {
      // Load context from Gateway
      this.editorialContext = await this.api.getEditorialContext();
      this.updateConnectionStatus(true);
    } catch (err) {
      this.updateConnectionStatus(false, err.message);
    }

    // Load unread notifications
    try {
      const notifs = await listNotifications();
      this.unreadNotifCount = notifs.filter(n => !n.read).length;
      const badge = this.container.querySelector('#notif-badge');
      if (badge) {
        badge.textContent = this.unreadNotifCount > 0 ? String(this.unreadNotifCount) : '';
        badge.style.display = this.unreadNotifCount > 0 ? 'inline-block' : 'none';
      }
    } catch (_) {}
  }

  updateConnectionStatus(connected, error = null) {
    const el = this.container.querySelector('#studio-connection-badge');
    if (!el) return;
    if (connected) {
      el.className = 'studio-badge badge-success';
      el.textContent = 'Gateway: Terhubung';
    } else {
      el.className = 'studio-badge badge-danger';
      el.textContent = 'Gateway: Terputus';
      if (error) el.title = error;
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="studio-workstation">
        <!-- Sub-Header Status & Nav -->
        <div class="studio-header">
          <div class="studio-title-row">
            <div>
              <span class="studio-brand">LokaBridge Studio</span>
              <span class="studio-version">v${PROMPT_VERSION}</span>
            </div>
            <div id="studio-connection-badge" class="studio-badge badge-neutral">Memeriksa...</div>
          </div>

          <!-- Secondary Access Links -->
          <div class="studio-subbar">
            <button type="button" class="subbar-link" data-sub="history">🕒 Histori</button>
            <button type="button" class="subbar-link" data-sub="calendar">📅 Kalender</button>
            <button type="button" class="subbar-link" data-sub="notifications">
              🔔 Notifikasi <span id="notif-badge" class="notif-pill" style="display:none;">0</span>
            </button>
            <button type="button" class="subbar-link" data-sub="settings">⚙️ Settings</button>
          </div>

          <!-- Primary Navigation Tabs -->
          <nav class="studio-tabs">
            <button type="button" class="studio-tab-btn active" data-tab="brief">1. Brief</button>
            <button type="button" class="studio-tab-btn" data-tab="content">2. Content</button>
            <button type="button" class="studio-tab-btn" data-tab="visual">3. Visual</button>
            <button type="button" class="studio-tab-btn" data-tab="jobs">4. Jobs</button>
          </nav>
        </div>

        <!-- Main Tab Panels Container -->
        <div id="studio-tab-content" class="studio-content-body">
          ${this.renderBriefTab()}
        </div>

        <div id="studio-toast" class="studio-toast" style="display:none;"></div>
      </div>
    `;
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    const tabBtns = this.container.querySelectorAll('.studio-tab-btn');
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const subLinks = this.container.querySelectorAll('.subbar-link');
    subLinks.forEach(lnk => {
      lnk.classList.toggle('active', lnk.dataset.sub === tabName);
    });

    const body = this.container.querySelector('#studio-tab-content');
    if (!body) return;

    if (tabName === 'brief') body.innerHTML = this.renderBriefTab();
    else if (tabName === 'content') body.innerHTML = this.renderContentTab();
    else if (tabName === 'visual') body.innerHTML = this.renderVisualTab();
    else if (tabName === 'jobs') body.innerHTML = this.renderJobsTab();
    else if (tabName === 'history') this.renderHistoryView(body);
    else if (tabName === 'calendar') this.renderCalendarView(body);
    else if (tabName === 'notifications') this.renderNotificationsView(body);
    else if (tabName === 'settings') body.innerHTML = this.renderSettingsView();

    this.bindTabEvents(tabName);
  }

  showToast(message, type = 'info') {
    const toast = this.container.querySelector('#studio-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `studio-toast toast-${type}`;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
  }

  // -------------------------------------------------------------------
  // TAB 1: BRIEF BUILDER
  // -------------------------------------------------------------------
  renderBriefTab() {
    return `
      <div class="studio-panel-tab">
        <section class="studio-card">
          <div class="card-head">
            <h3>Editorial Brief Builder</h3>
            <span class="session-label">Session: ${this.productionId.slice(0, 14)}...</span>
          </div>

          <div class="studio-form-group">
            <label>Topik / Pertanyaan Pembaca *</label>
            <input type="text" id="brief-topic" class="studio-input" placeholder="Misal: Perbandingan gypsum vs GRC untuk plafon" value="${this.brief.topic}">
          </div>

          <div class="studio-form-group">
            <label>Focus Keyword (Primer) *</label>
            <div style="display:flex; gap:6px;">
              <input type="text" id="brief-keyword" class="studio-input" placeholder="Misal: plafon drop ceiling gypsum" value="${this.brief.focusKeyword}">
              <button type="button" id="btn-preflight-kw" class="btn-secondary btn-sm" title="Periksa kanibalisasi kata kunci">Preflight</button>
            </div>
            <div id="preflight-status" style="font-size:11px; margin-top:4px; display:none;"></div>
          </div>

          <div class="studio-form-group">
            <label>Sudut Pandang (Editorial Angle) *</label>
            <select id="brief-angle" class="studio-select">
              <option value="Problem Solving" ${this.brief.angle === 'Problem Solving' ? 'selected' : ''}>Problem Solving (Solusi Masalah Nyata)</option>
              <option value="Practical Guide" ${this.brief.angle === 'Practical Guide' ? 'selected' : ''}>Practical Guide (Panduan Teknis A-Z)</option>
              <option value="Material Comparison" ${this.brief.angle === 'Material Comparison' ? 'selected' : ''}>Material Comparison (Komparasi Bahan)</option>
              <option value="Technical Insight" ${this.brief.angle === 'Technical Insight' ? 'selected' : ''}>Technical Insight (Analisis Struktur Mendalam)</option>
              <option value="Architectural Inspiration" ${this.brief.angle === 'Architectural Inspiration' ? 'selected' : ''}>Architectural Inspiration (Estetika & Ruang)</option>
              <option value="Owner Custom Angle" ${this.brief.angle === 'Owner Custom Angle' ? 'selected' : ''}>⭐ Owner Custom Angle (Bebas Alami)</option>
            </select>
          </div>

          <div id="custom-angle-box" class="studio-form-group" style="${this.brief.angle === 'Owner Custom Angle' ? '' : 'display:none;'}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label>Arahan Sudut Pandang Khusus (Owner Direction)</label>
              <button type="button" id="btn-save-custom-angle" class="btn-link-action" style="font-size:10px;">Simpan Preset</button>
            </div>
            <textarea id="brief-custom-angle" class="studio-textarea" rows="2" placeholder="Tuliskan arahan editorial bebas kamu...">${this.brief.customAngleNotes}</textarea>
          </div>

          <div class="studio-form-group">
            <label>URL Referensi (Satu per baris)</label>
            <textarea id="brief-ref-urls" class="studio-textarea" rows="2" placeholder="https://example.com/source1\nhttps://example.com/source2">${this.brief.referenceUrls}</textarea>
          </div>

          <div class="studio-form-group">
            <label>Platform AI Sasaran</label>
            <select id="brief-provider" class="studio-select">
              <option value="chatgpt_plus" ${this.brief.provider === 'chatgpt_plus' ? 'selected' : ''}>ChatGPT Plus (Browser Composer)</option>
              <option value="gemini_advanced" ${this.brief.provider === 'gemini_advanced' ? 'selected' : ''}>Gemini Advanced (Google AI)</option>
              <option value="claude_pro" ${this.brief.provider === 'claude_pro' ? 'selected' : ''}>Claude Pro (Anthropic)</option>
            </select>
          </div>

          <div class="studio-action-row" style="margin-top:12px;">
            <button type="button" id="btn-generate-article-prompt" class="btn-primary" style="width:100%;">
              ⚡ Susun &amp; Salin Prompt Editorial
            </button>
          </div>
        </section>

        <!-- Prompt Modal / Preview Drawer -->
        <section id="prompt-preview-drawer" class="studio-card" style="display:none; margin-top:10px;">
          <div class="card-head">
            <h4>Prompt Siap Kirim (${this.brief.provider})</h4>
            <button type="button" id="btn-close-prompt-drawer" class="btn-sm btn-ghost">✕</button>
          </div>
          <textarea id="generated-prompt-text" class="studio-textarea prompt-box" readonly></textarea>
          <div style="display:flex; gap:6px; margin-top:8px;">
            <button type="button" id="btn-copy-prompt" class="btn-primary btn-sm" style="flex:1;">📋 Salin ke Clipboard</button>
            <button type="button" id="btn-goto-content" class="btn-secondary btn-sm" style="flex:1;">Lanjut ke Content ➔</button>
          </div>
        </section>
      </div>
    `;
  }

  // -------------------------------------------------------------------
  // TAB 2: CONTENT & SMART REPAIR
  // -------------------------------------------------------------------
  renderContentTab() {
    const pkg = this.activePackage;
    const hasPkg = Boolean(pkg);

    return `
      <div class="studio-panel-tab">
        <section class="studio-card">
          <div class="card-head">
            <h3>Structured Package Parser</h3>
            <span class="session-label">${hasPkg ? 'Naskah Termuat' : 'Menunggu Tempel JSON'}</span>
          </div>

          <div class="studio-form-group">
            <label>Tempel Output Kode JSON dari ChatGPT / Gemini</label>
            <textarea id="raw-package-input" class="studio-textarea" rows="4" placeholder="Tempel blok \`\`\`json ... \`\`\` dari AI di sini..."></textarea>
          </div>

          <div class="studio-action-row">
            <button type="button" id="btn-parse-package" class="btn-secondary" style="flex:1;">🔍 Periksa &amp; Validasi Naskah</button>
            <button type="button" id="btn-smart-repair" class="btn-warning" style="flex:1; display:${this.validationErrors.length > 0 ? 'block' : 'none'};">🛠️ Salin Prompt Smart Repair</button>
          </div>

          <!-- Validation Error / Warnings Banners -->
          <div id="validation-errors-box" style="margin-top:8px; display:${this.validationErrors.length > 0 ? 'block' : 'none'};">
            <div class="banner-box banner-error">
              <strong>Gagal Memenuhi Standar Gate A:</strong>
              <ul style="margin:4px 0 0 16px; padding:0;">
                ${this.validationErrors.map(e => `<li>${e}</li>`).join('')}
              </ul>
            </div>
          </div>

          <div id="validation-warnings-box" style="margin-top:8px; display:${this.validationWarnings.length > 0 ? 'block' : 'none'};">
            <div class="banner-box banner-warning">
              <strong>Catatan Redaksi:</strong>
              <ul style="margin:4px 0 0 16px; padding:0;">
                ${this.validationWarnings.map(w => `<li>${w}</li>`).join('')}
              </ul>
            </div>
          </div>
        </section>

        <!-- Naskah Preview & Metadata Card -->
        ${hasPkg ? `
        <section class="studio-card" style="margin-top:10px;">
          <div class="card-head">
            <h4>Preview Metadata &amp; Ringkasan</h4>
            <span class="studio-badge ${this.validationErrors.length === 0 ? 'badge-success' : 'badge-danger'}">
              ${this.validationErrors.length === 0 ? 'Siap Kirim' : 'Perlu Perbaikan'}
            </span>
          </div>
          <div class="meta-details">
            <div><strong>Judul:</strong> ${pkg.title} <span style="font-size:10px; color:var(--muted);">(${pkg.title.length} char)</span></div>
            <div><strong>Slug:</strong> <code>${pkg.slug}</code></div>
            <div><strong>Focus Keyword:</strong> <code>${pkg.focus_keyword}</code></div>
            <div><strong>Kata:</strong> ~${pkg.content_md ? pkg.content_md.split(/\s+/).filter(Boolean).length : 0} kata</div>
            <div><strong>Subbab H2:</strong> ${(pkg.content_md ? pkg.content_md.match(/^##\s+/gm) || [] : []).length} subbab</div>
          </div>

          <div style="margin-top:10px; display:flex; gap:6px;">
            <button type="button" id="btn-goto-visual" class="btn-primary" style="flex:1;">Lanjut ke Visual Slots ➔</button>
          </div>
        </section>
        ` : ''}
      </div>
    `;
  }

  // -------------------------------------------------------------------
  // TAB 3: VISUAL PRODUCTION MANAGER
  // -------------------------------------------------------------------
  renderVisualTab() {
    const slots = this.visualSlots;

    return `
      <div class="studio-panel-tab">
        <section class="studio-card">
          <div class="card-head">
            <h3>Visual Production Manager</h3>
            <span class="session-label">${slots.filter(s => s.is_approved).length}/${slots.length} Disetujui</span>
          </div>
          <div style="font-size:11px; color:var(--muted); margin-bottom:10px;">
            Aturan Visual: Cover Hero wajib 1315×660px (~2:1), gambar inline rasio 16:9 fotorealistik arsitektur tropis.
          </div>

          <div class="slots-list">
            ${slots.map((slot, index) => `
              <div class="slot-card" data-index="${index}">
                <div class="slot-header">
                  <strong>${slot.role === 'cover_hero' ? 'Cover Hero (1315×660)' : `Inline Visual #${index} (16:9)`}</strong>
                  <label class="approval-toggle">
                    <input type="checkbox" class="slot-approval-chk" ${slot.is_approved ? 'checked' : ''} data-index="${index}">
                    <span>${slot.is_approved ? 'Disetujui' : 'Belum'}</span>
                  </label>
                </div>

                <div class="slot-body">
                  <div class="slot-preview-box">
                    ${slot.original_url ? `
                      <img src="${slot.original_url}" alt="${slot.alt_text}" class="slot-img-preview">
                    ` : `
                      <div class="slot-placeholder">Belum Ada Gambar</div>
                    `}
                  </div>

                  <div class="slot-controls">
                    <div class="studio-form-group">
                      <label style="font-size:10px;">Teks Alt (Wajib SEO)</label>
                      <input type="text" class="studio-input slot-alt-input" data-index="${index}" value="${slot.alt_text || ''}" placeholder="Deskripsi gambar untuk SEO">
                    </div>
                    <div style="display:flex; gap:4px; margin-top:4px;">
                      <button type="button" class="btn-secondary btn-sm btn-copy-slot-prompt" data-index="${index}" title="Salin prompt gambar untuk Kling / DALL-E / Midjourney">Copy Prompt</button>
                      <button type="button" class="btn-secondary btn-sm btn-upload-slot" data-index="${index}">Unggah File</button>
                    </div>
                    <input type="file" class="slot-file-input" data-index="${index}" accept="image/jpeg,image/png,image/webp" style="display:none;">
                  </div>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Schedule Intent Section -->
          <div class="studio-card" style="margin-top:12px; background:var(--panel);">
            <div class="card-head">
              <h4>Jadwal Publikasi (Asia/Jakarta WIB)</h4>
            </div>
            <div style="display:flex; gap:6px;">
              <input type="date" id="schedule-date" class="studio-input" value="${this.brief.scheduleDate || new Date().toISOString().split('T')[0]}" style="flex:2;">
              <input type="time" id="schedule-time" class="studio-input" value="${this.brief.scheduleTime || '10:00'}" style="flex:1;">
            </div>
            <div style="font-size:10px; color:var(--muted); margin-top:4px;">
              Catatan: Status artikel tetap <code>draft</code> &amp; <code>manual_hold=1</code>. Niat jadwal akan dicatat tanpa publikasi mandiri otomatis.
            </div>
          </div>

          <div class="studio-action-row" style="margin-top:12px;">
            <button type="button" id="btn-submit-studio-package" class="btn-primary" style="width:100%;" ${!this.activePackage ? 'disabled' : ''}>
              🚀 Kirim ke Server Import Orchestrator
            </button>
          </div>
        </section>
      </div>
    `;
  }

  // -------------------------------------------------------------------
  // TAB 4: JOBS DASHBOARD & NOTIFICATIONS
  // -------------------------------------------------------------------
  renderJobsTab() {
    const job = this.currentJob;

    return `
      <div class="studio-panel-tab">
        <section class="studio-card">
          <div class="card-head">
            <h3>Server Import Orchestrator</h3>
            <button type="button" id="btn-start-new-article" class="btn-secondary btn-sm">Mulai Artikel Baru</button>
          </div>

          ${job ? `
            <div class="job-summary-box">
              <div class="status-row">
                <span>Job ID</span>
                <code>${job.job_id}</code>
              </div>
              <div class="status-row">
                <span>Overall Status</span>
                <span class="studio-badge ${job.overall_status === 'COMPLETE' ? 'badge-success' : job.overall_status === 'FAILED' ? 'badge-danger' : 'badge-warning'}">
                  ${job.overall_status}
                </span>
              </div>
              ${job.reader_preview_url ? `
                <div style="margin-top:8px;">
                  <a href="${job.reader_preview_url}" target="_blank" class="btn-primary btn-sm" style="display:block; text-align:center; text-decoration:none;">
                    👁️ Buka Reader Preview Bertoken
                  </a>
                </div>
              ` : ''}
            </div>

            <!-- Pipeline Status Cards -->
            <div class="pipeline-status-list" style="margin-top:10px;">
              <h4>Status Pipeline Independen</h4>
              ${this.renderPipelinePills(job.pipeline_states)}
            </div>

            ${job.overall_status === 'FAILED' || job.overall_status === 'NEEDS_ATTENTION' ? `
              <div style="margin-top:10px;">
                <button type="button" id="btn-retry-job" class="btn-warning btn-sm" style="width:100%;">
                  🔄 Ulangi Pipeline Gagal (Targeted Retry)
                </button>
              </div>
            ` : ''}
          ` : `
            <div class="preview-placeholder">
              Belum ada import job yang aktif. Kirim naskah dari tab Visual untuk memulai pemrosesan mandiri server.
            </div>
          `}
        </section>
      </div>
    `;
  }

  renderPipelinePills(states = {}) {
    const pipelines = [
      { key: 'content', label: '1. Content' },
      { key: 'seo', label: '2. SEO & Keyword' },
      { key: 'media', label: '3. Media Ingress' },
      { key: 'evidence', label: '4. Evidence Verification' },
      { key: 'internal_linking', label: '5. Internal Linking' },
      { key: 'schedule_intent', label: '6. Schedule Intent' },
      { key: 'final_assembly', label: '7. Final Assembly' },
      { key: 'integrity_verification', label: '8. Integrity Read-Back' }
    ];

    return `
      <div class="pipeline-grid">
        ${pipelines.map(p => {
          const st = states[p.key] || 'PENDING';
          const badgeClass = st === 'COMPLETE' ? 'badge-success' : st === 'FAILED' ? 'badge-danger' : st === 'RUNNING' ? 'badge-warning' : 'badge-neutral';
          return `
            <div class="pipeline-item">
              <span>${p.label}</span>
              <span class="studio-badge ${badgeClass}">${st}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // -------------------------------------------------------------------
  // SECONDARY VIEWS: History, Calendar, Notifications, Settings
  // -------------------------------------------------------------------
  async renderHistoryView(container) {
    container.innerHTML = `
      <div class="studio-panel-tab">
        <section class="studio-card">
          <div class="card-head">
            <h3>Histori Produksi LokaBridge</h3>
            <button type="button" class="btn-sm btn-ghost btn-back-to-brief">➔ Kembali</button>
          </div>
          <div id="history-items-list" style="margin-top:8px;">Memuat riwayat...</div>
        </section>
      </div>
    `;

    const listEl = container.querySelector('#history-items-list');
    try {
      const sessions = await listSessions();
      if (!sessions || sessions.length === 0) {
        listEl.innerHTML = '<div class="preview-placeholder">Belum ada riwayat sesi produksi.</div>';
        return;
      }
      listEl.innerHTML = `
        <div class="history-list">
          ${sessions.map(s => `
            <div class="history-item-card">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <strong>${s.title || '(Tanpa Judul)'}</strong>
                <span class="studio-badge badge-neutral" style="font-size:9px;">${s.production_id.slice(0, 10)}</span>
              </div>
              <div style="font-size:11px; color:var(--muted); margin-top:2px;">
                Keyword: <code>${s.focus_keyword || '--'}</code>
              </div>
              <div style="display:flex; gap:4px; margin-top:6px;">
                <button type="button" class="btn-secondary btn-sm btn-load-session" data-pid="${s.production_id}">Buka Sesi</button>
                <button type="button" class="btn-danger btn-sm btn-delete-session" data-pid="${s.production_id}">Hapus</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      listEl.querySelectorAll('.btn-load-session').forEach(btn => {
        btn.addEventListener('click', async () => {
          const sess = await getSession(btn.dataset.pid);
          if (sess) {
            this.productionId = sess.production_id;
            this.brief.topic = sess.title || '';
            this.brief.focusKeyword = sess.focus_keyword || '';
            this.activePackage = sess.package || null;
            this.visualSlots = sess.visual_slots || this.visualSlots;
            this.currentJob = sess.job || null;
            this.showToast('Sesi berhasil dimuat!');
            this.switchTab('brief');
          }
        });
      });

      listEl.querySelectorAll('.btn-delete-session').forEach(btn => {
        btn.addEventListener('click', async () => {
          await deleteSession(btn.dataset.pid);
          await this.renderHistoryView(container);
        });
      });
    } catch (err) {
      listEl.innerHTML = `<div class="banner-box banner-error">Gagal memuat histori: ${err.message}</div>`;
    }

    container.querySelector('.btn-back-to-brief')?.addEventListener('click', () => this.switchTab('brief'));
  }

  async renderCalendarView(container) {
    container.innerHTML = `
      <div class="studio-panel-tab">
        <section class="studio-card">
          <div class="card-head">
            <h3>Kalender Publikasi (WIB)</h3>
            <button type="button" class="btn-sm btn-ghost btn-back-to-brief">➔ Kembali</button>
          </div>
          <div style="display:flex; gap:6px; margin-top:8px;">
            <input type="date" id="cal-date-picker" class="studio-input" value="${new Date().toISOString().split('T')[0]}">
            <button type="button" id="btn-refresh-calendar" class="btn-secondary btn-sm">Periksa Slot</button>
          </div>
          <div id="calendar-slots-list" style="margin-top:10px;">Memeriksa slot...</div>
        </section>
      </div>
    `;

    const picker = container.querySelector('#cal-date-picker');
    const listEl = container.querySelector('#calendar-slots-list');

    const loadSlots = async (date) => {
      listEl.innerHTML = 'Memeriksa slot ketersediaan...';
      try {
        const cal = await this.api.getCalendarSlots(date);
        listEl.innerHTML = `
          <div class="cal-slots-grid">
            ${cal.slots.map(s => `
              <div class="cal-slot-item ${s.status === 'AVAILABLE' ? 'slot-avail' : 'slot-busy'}">
                <div style="display:flex; justify-content:space-between;">
                  <strong>Slot #${s.slot_index} (${s.time_wib})</strong>
                  <span class="studio-badge ${s.status === 'AVAILABLE' ? 'badge-success' : 'badge-warning'}">${s.status}</span>
                </div>
                ${s.article_title ? `<div style="font-size:11px; margin-top:4px;">${s.article_title}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `;
      } catch (err) {
        listEl.innerHTML = `<div class="banner-box banner-error">Gagal memuat slot: ${err.message}</div>`;
      }
    };

    container.querySelector('#btn-refresh-calendar')?.addEventListener('click', () => loadSlots(picker.value));
    container.querySelector('.btn-back-to-brief')?.addEventListener('click', () => this.switchTab('brief'));
    loadSlots(picker.value);
  }

  async renderNotificationsView(container) {
    container.innerHTML = `
      <div class="studio-panel-tab">
        <section class="studio-card">
          <div class="card-head">
            <h3>Notifikasi Studio</h3>
            <button type="button" class="btn-sm btn-ghost btn-back-to-brief">➔ Kembali</button>
          </div>
          <div id="notifs-list" style="margin-top:8px;">Memuat notifikasi...</div>
        </section>
      </div>
    `;

    const listEl = container.querySelector('#notifs-list');
    try {
      const items = await listNotifications();
      if (!items || items.length === 0) {
        listEl.innerHTML = '<div class="preview-placeholder">Belum ada notifikasi.</div>';
        return;
      }
      listEl.innerHTML = `
        <div class="notif-list">
          ${items.map(n => `
            <div class="notif-card ${n.read ? 'notif-read' : 'notif-unread'}">
              <div style="display:flex; justify-content:space-between;">
                <strong>${n.title}</strong>
                <span style="font-size:10px; color:var(--muted);">${new Date(n.created_at).toLocaleTimeString('id-ID')}</span>
              </div>
              <div style="font-size:11px; margin-top:2px;">${n.message}</div>
              ${n.preview_url ? `<a href="${n.preview_url}" target="_blank" class="btn-link-action" style="font-size:10px;">Buka Preview</a>` : ''}
            </div>
          `).join('')}
        </div>
      `;

      // Mark all read
      for (const item of items) {
        if (!item.read) await markNotificationRead(item.id);
      }
      this.unreadNotifCount = 0;
      const badge = this.container.querySelector('#notif-badge');
      if (badge) badge.style.display = 'none';
    } catch (err) {
      listEl.innerHTML = `<div class="banner-box banner-error">${err.message}</div>`;
    }

    container.querySelector('.btn-back-to-brief')?.addEventListener('click', () => this.switchTab('brief'));
  }

  renderSettingsView() {
    return `
      <div class="studio-panel-tab">
        <section class="studio-card">
          <div class="card-head">
            <h3>Pengaturan LokaBridge</h3>
            <button type="button" class="btn-sm btn-ghost btn-back-to-brief">➔ Kembali</button>
          </div>
          <div class="studio-form-group">
            <label>API Gateway Base URL</label>
            <input type="text" id="setting-base-url" class="studio-input" value="${this.api.baseUrl}">
          </div>
          <div class="studio-form-group">
            <label>Device Token (lkmd_*)</label>
            <input type="password" id="setting-device-token" class="studio-input" value="${this.api.deviceToken || ''}" placeholder="Bearer token">
          </div>
          <button type="button" id="btn-save-settings" class="btn-primary" style="width:100%; margin-top:8px;">Simpan Pengaturan</button>
        </section>
      </div>
    `;
  }

  // -------------------------------------------------------------------
  // EVENT BINDINGS
  // -------------------------------------------------------------------
  bindGlobalEvents() {
    // Primary tab navigation
    this.container.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.studio-tab-btn');
      if (tabBtn) {
        this.switchTab(tabBtn.dataset.tab);
        return;
      }
      const subLink = e.target.closest('.subbar-link');
      if (subLink) {
        this.switchTab(subLink.dataset.sub);
        return;
      }
    });

    this.bindTabEvents('brief');
  }

  bindTabEvents(tabName) {
    if (tabName === 'brief') {
      const angleSelect = this.container.querySelector('#brief-angle');
      const customBox = this.container.querySelector('#custom-angle-box');
      angleSelect?.addEventListener('change', () => {
        this.brief.angle = angleSelect.value;
        if (customBox) {
          customBox.style.display = angleSelect.value === 'Owner Custom Angle' ? 'block' : 'none';
        }
      });

      // Preflight Keyword Cannibalization
      const kwInput = this.container.querySelector('#brief-keyword');
      const preflightBtn = this.container.querySelector('#btn-preflight-kw');
      const statusBox = this.container.querySelector('#preflight-status');

      preflightBtn?.addEventListener('click', async () => {
        const kw = (kwInput?.value || '').trim();
        if (!kw) {
          alert('Masukkan focus keyword terlebih dahulu.');
          return;
        }
        statusBox.style.display = 'block';
        statusBox.textContent = 'Memeriksa kanibalisasi...';
        try {
          const res = await this.api.checkKeyword(kw);
          if (res.cannibalization_risk === 'HIGH') {
            statusBox.style.color = 'var(--danger)';
            statusBox.textContent = `⚠️ Risiko Kanibalisasi Tinggi: Ada ${res.matching_articles?.length || 0} artikel yang menggunakan kata kunci serupa.`;
          } else {
            statusBox.style.color = 'var(--accent)';
            statusBox.textContent = '✓ Kata kunci aman dan belum digunakan!';
          }
        } catch (err) {
          statusBox.style.color = 'var(--danger)';
          statusBox.textContent = `Gagal periksa: ${err.message}`;
        }
      });

      // Save custom angle preset
      this.container.querySelector('#btn-save-custom-angle')?.addEventListener('click', async () => {
        const notes = this.container.querySelector('#brief-custom-angle')?.value || '';
        if (!notes) return alert('Tuliskan catatan angle terlebih dahulu.');
        await saveCustomAngle({ label: notes.slice(0, 30), instructions: notes });
        this.showToast('Custom Angle disimpan sebagai preset!');
      });

      // Generate Article Prompt
      this.container.querySelector('#btn-generate-article-prompt')?.addEventListener('click', () => {
        this.syncBriefInputs();
        if (!this.brief.topic && !this.brief.focusKeyword) {
          return alert('Topik atau Focus Keyword wajib diisi.');
        }

        const promptText = buildArticlePrompt({
          topic: this.brief.topic,
          focusKeyword: this.brief.focusKeyword,
          angle: this.brief.angle,
          customAngleNotes: this.brief.customAngleNotes,
          referenceUrls: this.brief.referenceUrls.split('\n').filter(Boolean),
          targetAudience: this.brief.targetAudience,
          category: this.brief.category,
          productionId: this.productionId
        });

        const drawer = this.container.querySelector('#prompt-preview-drawer');
        const textarea = this.container.querySelector('#generated-prompt-text');
        if (drawer && textarea) {
          textarea.value = promptText;
          drawer.style.display = 'block';
          navigator.clipboard.writeText(promptText);
          this.showToast('⚡ Prompt berhasil disusun dan disalin ke clipboard!', 'success');
        }
      });

      this.container.querySelector('#btn-close-prompt-drawer')?.addEventListener('click', () => {
        const drawer = this.container.querySelector('#prompt-preview-drawer');
        if (drawer) drawer.style.display = 'none';
      });

      this.container.querySelector('#btn-copy-prompt')?.addEventListener('click', () => {
        const txt = this.container.querySelector('#generated-prompt-text')?.value;
        if (txt) {
          navigator.clipboard.writeText(txt);
          this.showToast('📋 Prompt disalin!', 'success');
        }
      });

      this.container.querySelector('#btn-goto-content')?.addEventListener('click', () => {
        this.switchTab('content');
      });
    }

    if (tabName === 'content') {
      const parseBtn = this.container.querySelector('#btn-parse-package');
      const inputEl = this.container.querySelector('#raw-package-input');
      const smartRepairBtn = this.container.querySelector('#btn-smart-repair');

      parseBtn?.addEventListener('click', () => {
        const raw = inputEl?.value || '';
        if (!raw.trim()) return alert('Tempel output dari ChatGPT/Gemini terlebih dahulu.');

        const parseResult = parseStructuredEditorialPackage(raw, this.productionId);
        this.activePackage = parseResult.pkg;
        this.validationErrors = parseResult.errors || [];
        this.validationWarnings = parseResult.warnings || [];

        // Save session locally
        if (this.activePackage) {
          saveSession({
            production_id: this.productionId,
            title: this.activePackage.title,
            focus_keyword: this.activePackage.focus_keyword,
            package: this.activePackage,
            visual_slots: this.visualSlots
          });
        }

        this.switchTab('content');
        if (parseResult.isValid) {
          this.showToast('✓ Naskah lolos verifikasi Definition of Done (Gate A)!', 'success');
        } else {
          this.showToast('⚠️ Naskah memiliki kesalahan standar Gate A.', 'warning');
        }
      });

      smartRepairBtn?.addEventListener('click', () => {
        const repairPrompt = buildSmartRepairPrompt(this.validationErrors, [], this.activePackage || {});
        navigator.clipboard.writeText(repairPrompt);
        this.showToast('🛠️ Prompt Smart Repair disalin! Kirimkan ke AI untuk perbaikan terarah.', 'info');
      });

      this.container.querySelector('#btn-goto-visual')?.addEventListener('click', () => {
        this.switchTab('visual');
      });
    }

    if (tabName === 'visual') {
      // Slot approval toggles
      this.container.querySelectorAll('.slot-approval-chk').forEach(chk => {
        chk.addEventListener('change', () => {
          const idx = Number(chk.dataset.index);
          if (this.visualSlots[idx]) {
            this.visualSlots[idx].is_approved = chk.checked;
            this.renderVisualTab();
          }
        });
      });

      // Alt text edits
      this.container.querySelectorAll('.slot-alt-input').forEach(inp => {
        inp.addEventListener('input', () => {
          const idx = Number(inp.dataset.index);
          if (this.visualSlots[idx]) {
            this.visualSlots[idx].alt_text = inp.value;
          }
        });
      });

      // Copy slot prompt
      this.container.querySelectorAll('.btn-copy-slot-prompt').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.index);
          const slot = this.visualSlots[idx];
          if (slot) {
            const prompt = buildVisualPrompt(slot);
            navigator.clipboard.writeText(prompt);
            this.showToast(`Prompt ${slot.visual_id} disalin!`, 'info');
          }
        });
      });

      // Upload file trigger
      this.container.querySelectorAll('.btn-upload-slot').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.index);
          const fileInput = this.container.querySelector(`.slot-file-input[data-index="${idx}"]`);
          fileInput?.click();
        });
      });

      // Handle file selection & upload to RancangLoka media ingress
      this.container.querySelectorAll('.slot-file-input').forEach(inp => {
        inp.addEventListener('change', async () => {
          const idx = Number(inp.dataset.index);
          const slot = this.visualSlots[idx];
          const file = inp.files?.[0];
          if (!file || !slot) return;

          this.showToast(`Mengunggah ${slot.visual_id}...`, 'info');
          try {
            const res = await this.api.uploadAsset(file, slot.visual_id, slot.role, slot.alt_text, slot.caption);
            slot.original_url = res.public_url;
            slot.is_approved = true;
            this.showToast(`✓ ${slot.visual_id} berhasil diunggah ke media ingress!`, 'success');
            this.switchTab('visual');
          } catch (err) {
            alert(`Gagal unggah: ${err.message}`);
          }
        });
      });

      // Submit Package to Server Orchestrator
      this.container.querySelector('#btn-submit-studio-package')?.addEventListener('click', async () => {
        if (!this.activePackage) return alert('Naskah belum dimuat.');

        // Update schedule intent
        const schDate = this.container.querySelector('#schedule-date')?.value;
        const schTime = this.container.querySelector('#schedule-time')?.value;
        this.activePackage.schedule_intent = {
          requested_date: schDate,
          requested_time: schTime,
          timezone: 'Asia/Jakarta'
        };
        this.activePackage.visual_slots = this.visualSlots;

        this.showToast('Mengirimkan draf ke Server Orchestrator...', 'info');

        try {
          const submitRes = await this.api.submitImportJob(this.activePackage);
          this.currentJob = submitRes.job;

          // Record notification
          await addNotification({
            type: 'success',
            title: 'Draf Editorial Diterima Server',
            message: `Artikel #${submitRes.job_id} berhasil di-stage. Menjalankan pipeline mandiri.`,
            job_id: submitRes.job_id,
            preview_url: submitRes.reader_preview_url
          });

          // Save session
          await saveSession({
            production_id: this.productionId,
            title: this.activePackage.title,
            focus_keyword: this.activePackage.focus_keyword,
            package: this.activePackage,
            visual_slots: this.visualSlots,
            job: this.currentJob
          });

          this.showToast('🚀 Draf berhasil di-stage! Memulai monitoring pipeline...', 'success');
          this.switchTab('jobs');
          this.startJobPolling(submitRes.job_id);
        } catch (err) {
          alert(`Gagal mengirim draf: ${err.message}`);
        }
      });
    }

    if (tabName === 'jobs') {
      // Start new article (concurrent session)
      this.container.querySelector('#btn-start-new-article')?.addEventListener('click', () => {
        this.productionId = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        this.brief = {
          topic: '',
          focusKeyword: '',
          secondaryKeywords: '',
          angle: 'Problem Solving',
          customAngleNotes: '',
          referenceUrls: '',
          referenceText: '',
          targetAudience: 'Pemilik rumah tinggal tropis di Indonesia',
          category: 'Material & Struktur',
          provider: 'chatgpt_plus',
          scheduleDate: '',
          scheduleTime: '10:00'
        };
        this.activePackage = null;
        this.validationErrors = [];
        this.validationWarnings = [];
        this.currentJob = null;
        if (this.jobPollTimer) clearInterval(this.jobPollTimer);

        this.showToast('Sesi baru dimulai! Kamu dapat langsung mengerjakan artikel berikutnya.', 'info');
        this.switchTab('brief');
      });

      // Retry failed pipeline
      this.container.querySelector('#btn-retry-job')?.addEventListener('click', async () => {
        if (!this.currentJob) return;
        this.showToast('Mengulang pipeline gagal...', 'info');
        try {
          const res = await this.api.retryJobPipelines(this.currentJob.job_id);
          this.currentJob = res.job;
          this.switchTab('jobs');
        } catch (err) {
          alert(`Gagal retry: ${err.message}`);
        }
      });
    }
  }

  syncBriefInputs() {
    this.brief.topic = this.container.querySelector('#brief-topic')?.value || '';
    this.brief.focusKeyword = this.container.querySelector('#brief-keyword')?.value || '';
    this.brief.angle = this.container.querySelector('#brief-angle')?.value || 'Problem Solving';
    this.brief.customAngleNotes = this.container.querySelector('#brief-custom-angle')?.value || '';
    this.brief.referenceUrls = this.container.querySelector('#brief-ref-urls')?.value || '';
    this.brief.provider = this.container.querySelector('#brief-provider')?.value || 'chatgpt_plus';
  }

  startJobPolling(jobId) {
    if (this.jobPollTimer) clearInterval(this.jobPollTimer);
    this.jobPollTimer = setInterval(async () => {
      try {
        const res = await this.api.getImportJob(jobId);
        if (res && res.job) {
          this.currentJob = res.job;
          if (this.activeTab === 'jobs') {
            const body = this.container.querySelector('#studio-tab-content');
            if (body) body.innerHTML = this.renderJobsTab();
            this.bindTabEvents('jobs');
          }
          if (res.job.overall_status === 'COMPLETE' || res.job.overall_status === 'FAILED') {
            clearInterval(this.jobPollTimer);
            this.jobPollTimer = null;
          }
        }
      } catch (_) {}
    }, 3000);
  }
}
