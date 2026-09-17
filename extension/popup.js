/**
 * LokaMedia Extension — Operator Companion Logic (MEDIA-1)
 *
 * Implements:
 * 1. Universal Fallback: Drag & Drop, File Picker, Clipboard Paste (Ctrl+V)
 * 2. Client Preflight Validation: MIME, Size, Dimensions, Alt text
 * 3. Idempotent Upload: Double-click lock, safe retry on failure, dedup
 * 4. MEDIA-0 Upload API reuse with dedicated device token
 * 5. State persistence across extension reloads
 */

(function () {
  'use strict';

  // DOM Elements
  const elConnection = document.getElementById('connection-indicator');
  const elSettingsToggle = document.getElementById('btn-settings-toggle');
  const elSettingsPanel = document.getElementById('settings-panel');
  const elInputApiUrl = document.getElementById('input-api-url');
  const elInputDeviceToken = document.getElementById('input-device-token');
  const elBtnSaveSettings = document.getElementById('btn-save-settings');
  const elBtnRefreshJobs = document.getElementById('btn-refresh-jobs');
  const elSelectJob = document.getElementById('select-job');

  const elArticleTitle = document.getElementById('article-title');
  const elArticleSlug = document.getElementById('article-slug');
  const elSlotBadge = document.getElementById('slot-badge');
  const elPromptContent = document.getElementById('prompt-content');
  const elBtnCopyPrompt = document.getElementById('btn-copy-prompt');

  const elDropZone = document.getElementById('drop-zone');
  const elFileInput = document.getElementById('file-input');
  const elDropIdle = document.getElementById('drop-zone-idle');
  const elPreviewContainer = document.getElementById('preview-container');
  const elPreviewImage = document.getElementById('preview-image');
  const elSpecResolution = document.getElementById('spec-resolution');
  const elSpecSize = document.getElementById('spec-size');
  const elSpecMime = document.getElementById('spec-mime');
  const elBtnRemoveImage = document.getElementById('btn-remove-image');
  const elValidationMsg = document.getElementById('client-validation-msg');

  const elInputAltText = document.getElementById('input-alt-text');
  const elStatusBadge = document.getElementById('job-status-badge');
  const elBtnSend = document.getElementById('btn-send');
  const elBtnSendText = document.getElementById('btn-send-text');
  const elBtnRetry = document.getElementById('btn-retry');
  const elBtnSkip = document.getElementById('btn-skip');
  const elStatusMessage = document.getElementById('status-message');

  // Application State
  let config = {
    apiUrl: 'http://localhost:4321',
    deviceToken: 'staging-media-token'
  };

  let pendingJobs = [];
  let currentJob = null;
  let selectedFile = null;
  let selectedFileMeta = null;
  let isUploading = false;

  // 1. Storage Helpers (chrome.storage.local with localStorage fallback)
  async function loadStorage(keys) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
      });
    }
    const result = {};
    for (const key of keys) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        try {
          result[key] = JSON.parse(val);
        } catch (_) {
          result[key] = val;
        }
      }
    }
    return result;
  }

  async function saveStorage(obj) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set(obj, resolve);
      });
    }
    for (const [key, val] of Object.entries(obj)) {
      localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
    }
  }

  // 2. HTTP Helper with Device Token
  async function apiFetch(path, options = {}) {
    const url = `${config.apiUrl.replace(/\/+$/, '')}${path}`;
    const headers = new Headers(options.headers || {});

    if (config.deviceToken) {
      headers.set('Authorization', `Bearer ${config.deviceToken}`);
      headers.set('X-RL-Device-Token', config.deviceToken);
      headers.set('X-RL-Scope', 'media:write:draft');
    }

    const resp = await fetch(url, { ...options, headers });
    return resp;
  }

  // 3. UI Status Updating
  function setJobStatus(status, textMessage = '', isError = false) {
    elStatusBadge.textContent = status;
    elStatusBadge.className = `badge badge-status ${status}`;

    if (textMessage) {
      elStatusMessage.textContent = textMessage;
      elStatusMessage.className = `status-message text-xs ${isError ? 'error' : 'success'}`;
    } else {
      elStatusMessage.textContent = '';
      elStatusMessage.className = 'status-message text-xs';
    }

    if (status === 'UPLOADING') {
      elBtnSend.disabled = true;
      elBtnSendText.textContent = '⏳ Mengunggah ke R2...';
      elBtnRetry.classList.add('hidden');
    } else if (status === 'ATTACHED') {
      elBtnSend.disabled = true;
      elBtnSendText.textContent = '✅ Terpasang di Artikel';
      elBtnRetry.classList.add('hidden');
    } else if (status === 'FAILED') {
      elBtnSend.disabled = false;
      elBtnSendText.textContent = '🚀 Kirim ke RancangLoka';
      elBtnRetry.classList.remove('hidden');
    } else if (status === 'READY_TO_UPLOAD') {
      elBtnSend.disabled = false;
      elBtnSendText.textContent = '🚀 Kirim ke RancangLoka';
      elBtnRetry.classList.add('hidden');
    } else {
      elBtnSend.disabled = true;
      elBtnSendText.textContent = '🚀 Kirim ke RancangLoka';
      elBtnRetry.classList.add('hidden');
    }
  }

  // 4. Job Management
  async function loadPendingJobs() {
    elSelectJob.innerHTML = '<option value="">Memuat antrean...</option>';
    try {
      const resp = await apiFetch('/api/internal/v1/media/jobs?status=PENDING');
      if (!resp.ok) {
        throw new Error(`Server status ${resp.status}`);
      }
      const data = await resp.json();
      pendingJobs = data.jobs || [];

      renderJobDropdown();
      elConnection.textContent = '● Terhubung';
      elConnection.className = 'indicator online';
    } catch (err) {
      console.warn('[LokaMedia] Gagal memuat jobs:', err);
      elConnection.textContent = '○ Terputus';
      elConnection.className = 'indicator offline';
      elSelectJob.innerHTML = '<option value="">(Tidak dapat terhubung ke server)</option>';
      setJobStatus('IDLE', 'Periksa koneksi server di menu ⚙️', true);
    }
  }

  function renderJobDropdown() {
    if (pendingJobs.length === 0) {
      elSelectJob.innerHTML = '<option value="">-- Tidak ada pekerjaan pending --</option>';
      resetWorkspace();
      return;
    }

    elSelectJob.innerHTML = '<option value="">-- Pilih Pekerjaan Media --</option>';
    pendingJobs.forEach((job) => {
      const opt = document.createElement('option');
      opt.value = job.job_id;
      opt.textContent = `[#${job.article_id}] ${job.article_title.substring(0, 36)}...`;
      elSelectJob.appendChild(opt);
    });

    // Auto-select first job if none active
    if (!currentJob && pendingJobs.length > 0) {
      selectJob(pendingJobs[0].job_id);
    }
  }

  async function selectJob(jobId) {
    if (!jobId) {
      resetWorkspace();
      return;
    }

    const job = pendingJobs.find((j) => j.job_id === jobId);
    if (!job) return;

    currentJob = job;
    elSelectJob.value = jobId;
    await saveStorage({ activeJobId: jobId });

    elArticleTitle.textContent = job.article_title;
    elArticleSlug.textContent = `/${job.article_slug}`;
    elSlotBadge.textContent = `${job.role.toUpperCase()} (${job.aspect_ratio || '16:9'})`;
    elPromptContent.textContent = job.prompt;
    elInputAltText.value = job.alt_text || '';

    // If job was previously marked attached in server, reflect it
    if (job.status === 'ATTACHED') {
      setJobStatus('ATTACHED', 'Pekerjaan ini sudah terpasang di D1 & R2.');
    } else {
      setJobStatus(selectedFile ? 'READY_TO_UPLOAD' : 'PENDING');
    }
  }

  function resetWorkspace() {
    currentJob = null;
    elArticleTitle.textContent = '-';
    elArticleSlug.textContent = '-';
    elSlotBadge.textContent = 'Featured (16:9)';
    elPromptContent.textContent = 'Pilih pekerjaan untuk menampilkan prompt...';
    elInputAltText.value = '';
    clearSelectedImage();
    setJobStatus('IDLE');
  }

  // 5. Universal Intake: Drag & Drop, File Picker, Clipboard Paste
  function setupUniversalIntake() {
    // A. Click dropzone to open file picker
    elDropZone.addEventListener('click', (e) => {
      if (e.target !== elBtnRemoveImage && !selectedFile) {
        elFileInput.click();
      }
    });

    elFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processIncomingFile(e.target.files[0]);
      }
    });

    // B. Drag and Drop events
    elDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      elDropZone.classList.add('dragover');
    });

    elDropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      elDropZone.classList.remove('dragover');
    });

    elDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      elDropZone.classList.remove('dragover');

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processIncomingFile(e.dataTransfer.files[0]);
      }
    });

    // C. Clipboard Paste (Ctrl+V anywhere in popup)
    window.addEventListener('paste', (e) => {
      if (e.clipboardData && e.clipboardData.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              processIncomingFile(file);
              return;
            }
          }
        }
      }
    });

    // D. Remove image button
    elBtnRemoveImage.addEventListener('click', (e) => {
      e.stopPropagation();
      clearSelectedImage();
    });
  }

  // 6. Preflight Validation & Preview
  function processIncomingFile(file) {
    clearValidation();

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxBytes = 5 * 1024 * 1024; // 5 MB

    // Precheck MIME
    if (!allowedMimes.includes(file.type)) {
      showValidation(`Format ${file.type || 'file'} tidak didukung. Harap gunakan JPEG, PNG, atau WebP.`);
      return;
    }

    // Precheck Size
    if (file.size > maxBytes) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      showValidation(`Ukuran gambar ${sizeMB} MB melebihi batas 5 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Precheck Dimensions
        if (img.naturalWidth < 600 || img.naturalHeight < 338) {
          showValidation(`Resolusi ${img.naturalWidth}x${img.naturalHeight} terlalu kecil (minimum 600x338).`);
          return;
        }

        selectedFile = file;
        selectedFileMeta = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          sizeBytes: file.size,
          mimeType: file.type
        };

        // Render Preview
        elPreviewImage.src = e.target.result;
        elSpecResolution.textContent = `${img.naturalWidth}x${img.naturalHeight}`;
        elSpecSize.textContent = `${(file.size / 1024).toFixed(0)} KB`;
        elSpecMime.textContent = file.type.split('/')[1].toUpperCase();

        elDropIdle.classList.add('hidden');
        elPreviewContainer.classList.remove('hidden');

        if (currentJob) {
          setJobStatus('READY_TO_UPLOAD');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function clearSelectedImage() {
    selectedFile = null;
    selectedFileMeta = null;
    elFileInput.value = '';
    elPreviewImage.src = '';
    elPreviewContainer.classList.add('hidden');
    elDropIdle.classList.remove('hidden');
    clearValidation();
    if (currentJob && currentJob.status !== 'ATTACHED') {
      setJobStatus('PENDING');
    }
  }

  function showValidation(msg) {
    elValidationMsg.textContent = `⚠️ ${msg}`;
    elValidationMsg.classList.remove('hidden');
  }

  function clearValidation() {
    elValidationMsg.textContent = '';
    elValidationMsg.classList.add('hidden');
  }

  // 7. Send to RancangLoka API (Idempotent Upload)
  async function sendToRancangLoka() {
    if (!currentJob) {
      alert('Pilih pekerjaan media terlebih dahulu.');
      return;
    }
    if (!selectedFile) {
      alert('Pilih atau tempel gambar terlebih dahulu.');
      return;
    }
    if (isUploading) return; // Double-click lock

    const altText = elInputAltText.value.trim();
    if (!altText) {
      alert('Alt text wajib diisi sebelum mengunggah.');
      elInputAltText.focus();
      return;
    }

    isUploading = true;
    setJobStatus('UPLOADING', 'Mengunggah aset ke Cloudflare R2...');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('article_id', String(currentJob.article_id));
      formData.append('role', currentJob.role || 'featured');
      formData.append('alt_text', altText);
      formData.append('job_id', currentJob.job_id);

      const resp = await apiFetch('/api/internal/v1/media/upload', {
        method: 'POST',
        body: formData
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.message || `Gagal mengunggah (${resp.status})`);
      }

      // Success
      setJobStatus(
        'ATTACHED',
        `Berhasil! Gambar terpasang ke artikel #${currentJob.article_id} (${data.deduplicated ? 'Deduplicated' : 'New R2 Asset'}). Readiness: ${data.editorialReadiness}`
      );

      currentJob.status = 'ATTACHED';

      // Save completed job in storage
      const stored = await loadStorage(['completedJobIds']);
      const completedList = stored.completedJobIds || [];
      if (!completedList.includes(currentJob.job_id)) {
        completedList.push(currentJob.job_id);
        await saveStorage({ completedJobIds: completedList });
      }
    } catch (err) {
      console.error('[LokaMedia] Upload error:', err);
      setJobStatus('FAILED', `Gagal: ${err.message}`, true);
    } finally {
      isUploading = false;
    }
  }

  // 8. Skip Job
  async function skipCurrentJob() {
    if (!currentJob) return;
    if (!confirm(`Lewati pekerjaan media untuk "${currentJob.article_title}"?`)) return;

    try {
      await apiFetch(`/api/internal/v1/media/jobs/${encodeURIComponent(currentJob.job_id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SKIPPED' })
      });
      await loadPendingJobs();
    } catch (err) {
      alert(`Gagal melewati pekerjaan: ${err.message}`);
    }
  }

  // 9. Copy Prompt
  function copyPrompt() {
    if (!currentJob || !currentJob.prompt) return;
    navigator.clipboard.writeText(currentJob.prompt).then(() => {
      const origText = elBtnCopyPrompt.textContent;
      elBtnCopyPrompt.textContent = '✅ Tersalin!';
      elBtnCopyPrompt.classList.add('btn-primary');
      setTimeout(() => {
        elBtnCopyPrompt.textContent = origText;
        elBtnCopyPrompt.classList.remove('btn-primary');
      }, 1500);
    });
  }

  // 10. Initialization & Event Binding
  async function init() {
    // Load config from storage
    const stored = await loadStorage(['apiUrl', 'deviceToken', 'activeJobId']);
    if (stored.apiUrl) config.apiUrl = stored.apiUrl;
    if (stored.deviceToken) config.deviceToken = stored.deviceToken;

    elInputApiUrl.value = config.apiUrl;
    elInputDeviceToken.value = config.deviceToken;

    // Toggle settings panel
    elSettingsToggle.addEventListener('click', () => {
      elSettingsPanel.classList.toggle('hidden');
    });

    // Save settings
    elBtnSaveSettings.addEventListener('click', async () => {
      config.apiUrl = elInputApiUrl.value.trim() || 'http://localhost:4321';
      config.deviceToken = elInputDeviceToken.value.trim();
      await saveStorage({
        apiUrl: config.apiUrl,
        deviceToken: config.deviceToken
      });
      elSettingsPanel.classList.add('hidden');
      await loadPendingJobs();
    });

    // Refresh jobs button
    elBtnRefreshJobs.addEventListener('click', () => {
      loadPendingJobs();
    });

    // Job dropdown change
    elSelectJob.addEventListener('change', (e) => {
      selectJob(e.target.value);
    });

    // Copy prompt
    elBtnCopyPrompt.addEventListener('click', copyPrompt);

    // Send button
    elBtnSend.addEventListener('click', sendToRancangLoka);

    // Retry button
    elBtnRetry.addEventListener('click', sendToRancangLoka);

    // Skip button
    elBtnSkip.addEventListener('click', skipCurrentJob);

    // Setup Intake (Universal Fallback)
    setupUniversalIntake();

    // Initial load
    await loadPendingJobs();

    // Restore active job if present
    if (stored.activeJobId) {
      selectJob(stored.activeJobId);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
